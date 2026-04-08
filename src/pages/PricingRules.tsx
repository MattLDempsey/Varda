import { useState } from 'react'
import { Save, RotateCcw } from 'lucide-react'
import type { CSSProperties } from 'react'
import { useTheme } from '../theme/ThemeContext'
import { useData, DEFAULT_PRICING_CONFIG, DEFAULT_JOB_TYPE_CONFIGS } from '../data/DataContext'
import FeatureGate from '../components/FeatureGate'
import SettingsNav from '../components/SettingsNav'
import type { PricingConfig, JobTypeConfig } from '../data/DataContext'

export default function PricingRules() {
  const { C } = useTheme()
  const { pricingConfig, jobTypeConfigs, updatePricingConfig, updateJobTypeConfig } = useData()
  const [saved, setSaved] = useState(false)

  // Local draft state — convert decimals to display percentages for UI
  const [config, setConfig] = useState<PricingConfig>({ ...pricingConfig })
  const [jobTypes, setJobTypes] = useState<JobTypeConfig[]>(jobTypeConfigs.map(j => ({ ...j })))

  const updateConfig = (key: keyof PricingConfig, value: number) => {
    setConfig(prev => ({ ...prev, [key]: value }))
    setSaved(false)
  }

  const updateJobType = (id: string, key: keyof JobTypeConfig, value: number | boolean) => {
    setJobTypes(prev => prev.map(j => j.id === id ? { ...j, [key]: value } : j))
    setSaved(false)
  }

  const handleSave = () => {
    // Persist all pricing config changes
    updatePricingConfig(config)
    // Persist each changed job type
    jobTypes.forEach(jt => {
      updateJobTypeConfig(jt.id, jt)
    })
    setSaved(true)
  }

  const handleReset = () => {
    setConfig({ ...DEFAULT_PRICING_CONFIG })
    setJobTypes(DEFAULT_JOB_TYPE_CONFIGS.map(j => ({ ...j })))
    // Also persist the reset immediately
    updatePricingConfig(DEFAULT_PRICING_CONFIG)
    DEFAULT_JOB_TYPE_CONFIGS.forEach(jt => {
      updateJobTypeConfig(jt.id, jt)
    })
    setSaved(false)
  }

  // Display helpers: convert decimal to percentage for UI
  const displayVatRate = config.vatRate < 1 ? config.vatRate * 100 : config.vatRate
  const displayWastePct = config.wastePct < 1 ? config.wastePct * 100 : config.wastePct
  const displayMarginTarget = config.marginTarget < 1 ? config.marginTarget * 100 : config.marginTarget

  /* ── styles ── */
  const s: Record<string, CSSProperties> = {
    page: { padding: 32, maxWidth: 1200, margin: '0 auto' },
    header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 },
    heading: { fontSize: 28, fontWeight: 600, color: C.white },
    headerActions: { display: 'flex', gap: 8 },
    btn: {
      display: 'flex', alignItems: 'center', gap: 6, padding: '10px 20px',
      borderRadius: 10, border: 'none', cursor: 'pointer', fontSize: 13,
      fontWeight: 600, minHeight: 44, transition: 'opacity .15s',
    },
    twoCol: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 },
    panel: { background: C.charcoalLight, borderRadius: 12, padding: '20px 24px' },
    panelTitle: { fontSize: 16, fontWeight: 600, color: C.white, marginBottom: 16 },
    fieldRow: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 },
    field: { marginBottom: 12 },
    label: { fontSize: 12, fontWeight: 600, color: C.silver, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6, display: 'block' },
    input: {
      width: '100%', background: C.black, border: `1px solid ${C.steel}44`,
      borderRadius: 8, padding: '10px 14px', color: C.white, fontSize: 14,
      outline: 'none', minHeight: 44, boxSizing: 'border-box',
    },
    inputSmall: {
      width: '100%', background: C.black, border: `1px solid ${C.steel}44`,
      borderRadius: 6, padding: '6px 10px', color: C.white, fontSize: 13,
      outline: 'none', minHeight: 36, boxSizing: 'border-box', textAlign: 'center',
    },
    sliderWrap: { marginBottom: 16 },
    sliderHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
    sliderValue: { fontSize: 14, fontWeight: 600, color: C.gold },
    slider: {
      width: '100%', height: 6, appearance: 'none', background: C.steel,
      borderRadius: 3, outline: 'none', cursor: 'pointer',
    },
    sliderLabels: { display: 'flex', justifyContent: 'space-between', fontSize: 11, color: C.steel, marginTop: 4 },
    // job type table
    tableWrap: { borderRadius: 12, overflow: 'hidden', marginBottom: 24 },
    table: { width: '100%', borderCollapse: 'collapse', background: C.charcoalLight },
    th: {
      textAlign: 'left', padding: '12px 10px', fontSize: 11, fontWeight: 600,
      color: C.silver, textTransform: 'uppercase', letterSpacing: 0.6,
      borderBottom: `1px solid ${C.steel}33`,
    },
    td: { padding: '8px 10px', fontSize: 13, color: C.white, borderBottom: `1px solid ${C.steel}1A` },
    toggle: {
      width: 40, height: 22, borderRadius: 11, border: 'none', cursor: 'pointer',
      position: 'relative', transition: 'background .15s',
    },
    toggleDot: {
      width: 16, height: 16, borderRadius: '50%', background: C.white,
      position: 'absolute', top: 3, transition: 'left .15s',
    },
    saved: {
      display: 'flex', alignItems: 'center', gap: 6, fontSize: 13,
      fontWeight: 500, color: C.green, padding: '10px 0',
    },
  }

  return (
    <FeatureGate feature="pricingRules">
    <div style={s.page}>
      <SettingsNav active="pricing" />
      {/* header */}
      <div style={s.header}>
        <h1 style={s.heading}>Pricing Rules</h1>
        <div style={s.headerActions}>
          {saved && (
            <div style={s.saved}>
              <Save size={14} /> Saved
            </div>
          )}
          <button style={{ ...s.btn, background: `${C.steel}33`, color: C.silver }} onClick={handleReset}>
            <RotateCcw size={16} /> Reset Defaults
          </button>
          <button style={{ ...s.btn, background: C.gold, color: C.black }} onClick={handleSave}>
            <Save size={16} /> Save Changes
          </button>
        </div>
      </div>

      {/* core rates */}
      <div style={s.twoCol}>
        <div style={s.panel}>
          <div style={s.panelTitle}>Core Rates</div>
          <div style={s.fieldRow}>
            <div>
              <label style={s.label}>Labour Rate (£/hr)</label>
              <input
                style={s.input}
                type="number"
                value={config.labourRate}
                onChange={e => updateConfig('labourRate', Number(e.target.value))}
              />
            </div>
            <div>
              <label style={s.label}>VAT Rate (%)</label>
              <input
                style={s.input}
                type="number"
                value={displayVatRate}
                onChange={e => updateConfig('vatRate', Number(e.target.value) / 100)}
              />
            </div>
          </div>
          <div style={s.fieldRow}>
            <div>
              <label style={s.label}>Cert Fee (£)</label>
              <input
                style={s.input}
                type="number"
                value={config.certFee}
                onChange={e => updateConfig('certFee', Number(e.target.value))}
              />
            </div>
            <div>
              <label style={s.label}>Waste (%)</label>
              <input
                style={s.input}
                type="number"
                value={displayWastePct}
                onChange={e => updateConfig('wastePct', Number(e.target.value) / 100)}
              />
            </div>
          </div>
          <div>
            <label style={s.label}>Margin Target (%)</label>
            <input
              style={s.input}
              type="number"
              value={displayMarginTarget}
              onChange={e => updateConfig('marginTarget', Number(e.target.value) / 100)}
            />
          </div>
        </div>

        {/* multipliers */}
        <div style={s.panel}>
          <div style={s.panelTitle}>Multipliers</div>

          <div style={s.sliderWrap}>
            <div style={s.sliderHeader}>
              <label style={s.label}>Emergency Multiplier</label>
              <span style={s.sliderValue}>{config.emergencyMult.toFixed(2)}x</span>
            </div>
            <input
              type="range" min={1} max={3} step={0.05}
              value={config.emergencyMult}
              onChange={e => updateConfig('emergencyMult', Number(e.target.value))}
              style={s.slider as CSSProperties}
            />
            <div style={s.sliderLabels as CSSProperties}><span>1.0x</span><span>3.0x</span></div>
          </div>

          <div style={s.sliderWrap}>
            <div style={s.sliderHeader}>
              <label style={s.label}>Out-of-Hours Multiplier</label>
              <span style={s.sliderValue}>{config.outOfHoursMult.toFixed(2)}x</span>
            </div>
            <input
              type="range" min={1} max={2.5} step={0.05}
              value={config.outOfHoursMult}
              onChange={e => updateConfig('outOfHoursMult', Number(e.target.value))}
              style={s.slider as CSSProperties}
            />
            <div style={s.sliderLabels as CSSProperties}><span>1.0x</span><span>2.5x</span></div>
          </div>

          <div style={s.sliderWrap}>
            <div style={s.sliderHeader}>
              <label style={s.label}>Difficulty Range</label>
              <span style={s.sliderValue}>{config.difficultyMin.toFixed(1)}x – {config.difficultyMax.toFixed(1)}x</span>
            </div>
            <input
              type="range" min={1} max={3} step={0.1}
              value={config.difficultyMax}
              onChange={e => updateConfig('difficultyMax', Number(e.target.value))}
              style={s.slider as CSSProperties}
            />
            <div style={s.sliderLabels as CSSProperties}><span>Max: 1.0x</span><span>3.0x</span></div>
          </div>

          <div style={s.sliderWrap}>
            <div style={s.sliderHeader}>
              <label style={s.label}>Hassle Factor Range</label>
              <span style={s.sliderValue}>{config.hassleMin.toFixed(1)}x – {config.hassleMax.toFixed(1)}x</span>
            </div>
            <input
              type="range" min={1} max={2.5} step={0.1}
              value={config.hassleMax}
              onChange={e => updateConfig('hassleMax', Number(e.target.value))}
              style={s.slider as CSSProperties}
            />
            <div style={s.sliderLabels as CSSProperties}><span>Max: 1.0x</span><span>2.5x</span></div>
          </div>
        </div>
      </div>

      {/* job type table */}
      <div style={s.panel}>
        <div style={s.panelTitle}>Job Type Defaults</div>
        <div style={{ overflowX: 'auto' }}>
          <table style={s.table}>
            <thead>
              <tr>
                <th style={s.th as CSSProperties}>Job Type</th>
                <th style={{ ...(s.th as CSSProperties), textAlign: 'center' }}>Materials (£)</th>
                <th style={{ ...(s.th as CSSProperties), textAlign: 'center' }}>Hours</th>
                <th style={{ ...(s.th as CSSProperties), textAlign: 'center' }}>Min Charge (£)</th>
                <th style={{ ...(s.th as CSSProperties), textAlign: 'center' }}>Cert Required</th>
                <th style={{ ...(s.th as CSSProperties), textAlign: 'center' }}>Per Unit</th>
              </tr>
            </thead>
            <tbody>
              {jobTypes.map(jt => (
                <tr key={jt.id}>
                  <td style={{ ...s.td, fontWeight: 500 }}>{jt.name}</td>
                  <td style={s.td}>
                    <input
                      style={s.inputSmall as CSSProperties}
                      type="number"
                      value={jt.baseMaterialCost}
                      onChange={e => updateJobType(jt.id, 'baseMaterialCost', Number(e.target.value))}
                    />
                  </td>
                  <td style={s.td}>
                    <input
                      style={s.inputSmall as CSSProperties}
                      type="number"
                      step={0.5}
                      value={jt.baseHours}
                      onChange={e => updateJobType(jt.id, 'baseHours', Number(e.target.value))}
                    />
                  </td>
                  <td style={s.td}>
                    <input
                      style={s.inputSmall as CSSProperties}
                      type="number"
                      value={jt.minCharge}
                      onChange={e => updateJobType(jt.id, 'minCharge', Number(e.target.value))}
                    />
                  </td>
                  <td style={{ ...s.td, textAlign: 'center' }}>
                    <button
                      style={{
                        ...s.toggle,
                        background: jt.certRequired ? C.gold : C.steel,
                      } as CSSProperties}
                      onClick={() => updateJobType(jt.id, 'certRequired', !jt.certRequired)}
                    >
                      <div style={{ ...s.toggleDot, left: jt.certRequired ? 20 : 4 } as CSSProperties} />
                    </button>
                  </td>
                  <td style={{ ...s.td, textAlign: 'center' }}>
                    <button
                      style={{
                        ...s.toggle,
                        background: jt.isPerUnit ? C.gold : C.steel,
                      } as CSSProperties}
                      onClick={() => updateJobType(jt.id, 'isPerUnit', !jt.isPerUnit)}
                    >
                      <div style={{ ...s.toggleDot, left: jt.isPerUnit ? 20 : 4 } as CSSProperties} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
    </FeatureGate>
  )
}
