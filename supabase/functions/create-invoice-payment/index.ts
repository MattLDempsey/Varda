// Supabase Edge Function: Create Stripe Checkout Session for Invoice Payment
// Deployed via: supabase functions deploy create-invoice-payment
// Secret required: STRIPE_SECRET_KEY
//
// This handles one-time payments from customers viewing their invoice.
// No auth required — customers are not logged in.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@14.14.0?target=deno'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, { apiVersion: '2023-10-16' })

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { invoiceId, orgId } = await req.json() as { invoiceId: string; orgId: string }

    if (!invoiceId || !orgId) {
      return new Response(JSON.stringify({ error: 'Missing invoiceId or orgId' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Look up the invoice
    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .select('id, ref, grand_total, status, customer_name, job_type_name')
      .eq('id', invoiceId)
      .eq('org_id', orgId)
      .single()

    if (invoiceError || !invoice) {
      return new Response(JSON.stringify({ error: 'Invoice not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (invoice.status === 'Paid') {
      return new Response(JSON.stringify({ error: 'Invoice is already paid' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Look up org's Stripe customer (from subscriptions) or create one
    const { data: sub } = await supabase
      .from('subscriptions')
      .select('stripe_customer_id')
      .eq('org_id', orgId)
      .single()

    let customerId = sub?.stripe_customer_id

    if (!customerId) {
      // Look up the org for email
      const { data: org } = await supabase
        .from('orgs')
        .select('name')
        .eq('id', orgId)
        .single()

      const customer = await stripe.customers.create({
        name: org?.name || 'Unknown Org',
        metadata: { org_id: orgId },
      })
      customerId = customer.id

      // Save Stripe customer ID
      await supabase
        .from('subscriptions')
        .update({ stripe_customer_id: customerId })
        .eq('org_id', orgId)
    }

    const origin = req.headers.get('origin') || 'https://app.thegreyhavens.co.uk'

    // Create Checkout Session for a one-time payment
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'payment',
      line_items: [{
        price_data: {
          currency: 'gbp',
          product_data: { name: `Invoice ${invoice.ref}` },
          unit_amount: Math.round(invoice.grand_total * 100), // pence
        },
        quantity: 1,
      }],
      success_url: `${origin}/inv/${invoiceId}?paid=true`,
      cancel_url: `${origin}/inv/${invoiceId}`,
      metadata: { invoice_id: invoiceId, org_id: orgId },
    })

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('Invoice payment checkout error:', err)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
