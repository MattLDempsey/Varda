// Supabase Edge Function: Stripe Webhook Handler
// Handles subscription lifecycle events from Stripe
// Deployed via: supabase functions deploy stripe-webhook
// Secrets required: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@14.14.0?target=deno'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, { apiVersion: '2023-10-16' })
const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')!

serve(async (req) => {
  const body = await req.text()
  const signature = req.headers.get('stripe-signature')!

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
  } catch (err) {
    console.error('Webhook signature verification failed:', err)
    return new Response('Webhook signature verification failed', { status: 400 })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        const orgId = session.metadata?.org_id

        // ── One-time invoice payment ──
        if (session.mode === 'payment' && session.metadata?.invoice_id) {
          const invoiceId = session.metadata.invoice_id
          const now = new Date().toISOString()

          // Mark the invoice as Paid
          await supabase
            .from('invoices')
            .update({ status: 'Paid', paid_at: now })
            .eq('id', invoiceId)

          // Check if the linked job should also move to Paid
          const { data: invoice } = await supabase
            .from('invoices')
            .select('job_id')
            .eq('id', invoiceId)
            .single()

          if (invoice?.job_id) {
            // Get all invoices for this job
            const { data: jobInvoices } = await supabase
              .from('invoices')
              .select('id, status')
              .eq('job_id', invoice.job_id)

            const allPaid = jobInvoices?.every(i => i.status === 'Paid')
            if (allPaid) {
              await supabase
                .from('jobs')
                .update({ status: 'Paid' })
                .eq('id', invoice.job_id)
            }
          }

          console.log(`✓ Invoice paid via Stripe: invoice=${invoiceId} org=${orgId}`)
          break
        }

        // ── Subscription checkout ──
        const plan = session.metadata?.plan
        if (!orgId || !plan) break

        await supabase
          .from('subscriptions')
          .update({
            plan,
            status: 'active',
            stripe_subscription_id: session.subscription as string,
            stripe_customer_id: session.customer as string,
            current_period_end: null, // Will be set by invoice.paid
          })
          .eq('org_id', orgId)

        console.log(`✓ Subscription activated: org=${orgId} plan=${plan}`)
        break
      }

      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice
        const subscriptionId = invoice.subscription as string
        if (!subscriptionId) break

        const sub = await stripe.subscriptions.retrieve(subscriptionId)
        const orgId = sub.metadata?.org_id
        if (!orgId) break

        await supabase
          .from('subscriptions')
          .update({
            status: 'active',
            current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
          })
          .eq('org_id', orgId)

        console.log(`✓ Invoice paid: org=${orgId}`)
        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        const subscriptionId = invoice.subscription as string
        if (!subscriptionId) break

        const sub = await stripe.subscriptions.retrieve(subscriptionId)
        const orgId = sub.metadata?.org_id
        if (!orgId) break

        await supabase
          .from('subscriptions')
          .update({ status: 'past_due' })
          .eq('org_id', orgId)

        console.log(`⚠ Payment failed: org=${orgId}`)
        break
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription
        const orgId = sub.metadata?.org_id
        if (!orgId) break

        await supabase
          .from('subscriptions')
          .update({
            plan: 'starter',
            status: 'cancelled',
            stripe_subscription_id: null,
            current_period_end: null,
          })
          .eq('org_id', orgId)

        console.log(`✗ Subscription cancelled: org=${orgId} → downgraded to starter`)
        break
      }

      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription
        const orgId = sub.metadata?.org_id
        if (!orgId) break

        const plan = sub.metadata?.plan || 'pro'
        const status = sub.status === 'active' ? 'active'
          : sub.status === 'past_due' ? 'past_due'
          : sub.status === 'canceled' ? 'cancelled'
          : 'active'

        await supabase
          .from('subscriptions')
          .update({
            plan,
            status,
            current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
          })
          .eq('org_id', orgId)

        console.log(`↻ Subscription updated: org=${orgId} plan=${plan} status=${status}`)
        break
      }

      default:
        console.log(`Unhandled event type: ${event.type}`)
    }
  } catch (err) {
    console.error('Webhook processing error:', err)
    return new Response('Webhook processing error', { status: 500 })
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
