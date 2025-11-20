import React from 'react';
import AutocompleteInput from './AutocompleteInput';
import GeoFilter from './components/GeoFilter.jsx';
import { useLanguage } from './context/LanguageContext.jsx';

const TaxonPill = React.memo(({ taxon, onRemove, label, removeLabel }) => (
  <div className="taxon-pill">
    <span>{label}</span>
    <button
      onClick={onRemove}
      className="remove-btn"
      title={removeLabel}
      aria-label={removeLabel}
    >
      ×
    </button>
  </div>
));

const FilterSection = ({ label, helper, enabled, onToggle, children }) => (
  <section className={`filter-section ${enabled ? 'open' : ''}`}>
    <label className="checkbox-label filter-section-toggle">
      <input type="checkbox" checked={enabled} onChange={onToggle} />
      <span className="custom-checkbox" aria-hidden="true"></span>
      {label}
    </label>
    {!enabled && helper && <p className="filter-helper">{helper}</p>}
    {enabled && <div className="filter-section-body">{children}</div>}
  </section>
);

function CustomFilter({ filters, dispatch }) {
  const { t, formatTaxonName } = useLanguage();
  const removeLabel = t('customFilter.remove_taxon');

  return (
    <div className="custom-filter-container">
      <FilterSection
        label={t('customFilter.filter_by_taxa')}
        helper={t('customFilter.taxa_helper')}
        enabled={filters.taxa_enabled}
        onToggle={() => dispatch({ type: 'TOGGLE_TAXA' })}
      >
        <div className="taxa-fieldsets">
          <fieldset>
            <legend>{t('customFilter.include_title')}</legend>
            <p className="custom-filter-description">{t('customFilter.include_description')}</p>
            <AutocompleteInput
              placeholder={t('customFilter.placeholder')}
              onSelect={(selection) => dispatch({ type: 'ADD_INCLUDED_TAXON', payload: selection })}
            />
            <div className="pills-container include-pills">
              {filters.includedTaxa.map(taxon => (
                <TaxonPill
                  key={taxon.id}
                  taxon={taxon}
                  label={formatTaxonName(taxon)}
                  removeLabel={removeLabel}
                  onRemove={() => dispatch({ type: 'REMOVE_INCLUDED_TAXON', payload: taxon.id })}
                />
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend>{t('customFilter.exclude_title')}</legend>
            <p className="custom-filter-description">{t('customFilter.exclude_description')}</p>
            <AutocompleteInput
              placeholder={t('customFilter.placeholder')}
              onSelect={(selection) => dispatch({ type: 'ADD_EXCLUDED_TAXON', payload: selection })}
            />
            <div className="pills-container exclude-pills">
              {filters.excludedTaxa.map(taxon => (
                <TaxonPill
                  key={taxon.id}
                  taxon={taxon}
                  label={formatTaxonName(taxon)}
                  removeLabel={removeLabel}
                  onRemove={() => dispatch({ type: 'REMOVE_EXCLUDED_TAXON', payload: taxon.id })}
                />
              ))}
            </div>
          </fieldset>
        </div>
      </FilterSection>

      <FilterSection
        label={t('customFilter.filter_by_place')}
        helper={t('customFilter.place_helper')}
        enabled={filters.place_enabled}
        onToggle={() => dispatch({ type: 'TOGGLE_PLACE' })}
      >
        <p className="custom-filter-description">{t('customFilter.place_helper')}</p>
        <GeoFilter value={filters.geo} onChange={(v) => dispatch({ type: 'SET_GEO', payload: v })} />
      </FilterSection>

      <FilterSection
        label={t('customFilter.filter_by_period')}
        helper={t('customFilter.period_helper')}
        enabled={filters.period_enabled}
        onToggle={() => dispatch({ type: 'TOGGLE_PERIOD' })}
      >
        <p className="custom-filter-description">{t('customFilter.period_helper')}</p>
        <div className="date-filters">
          <label htmlFor="filter-d1">{t('customFilter.period_from')}</label>
          <input
            id="filter-d1"
            className="form-input"
            type="date"
            name="d1"
            value={filters.d1}
            onChange={(e) => dispatch({ type: 'SET_FILTER', payload: { name: 'd1', value: e.target.value } })}
          />
          <label htmlFor="filter-d2">{t('customFilter.period_to')}</label>
          <input
            id="filter-d2"
            className="form-input"
            type="date"
            name="d2"
            value={filters.d2}
            onChange={(e) => dispatch({ type: 'SET_FILTER', payload: { name: 'd2', value: e.target.value } })}
          />
        </div>
      </FilterSection>
    </div>
  );
}

export default CustomFilter;
