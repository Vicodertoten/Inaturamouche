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

function CustomFilter({ filters, dispatch }) {
  const { t, formatTaxonName } = useLanguage();
  const removeLabel = t('customFilter.remove_taxon');

  // Nous n'avons plus besoin de créer les listes d'IDs ici.

  return (
    <div className="custom-filter-container">
      {/* --- SECTION INCLUSION --- */}
      <form onSubmit={(e) => e.preventDefault()}>
      <fieldset>
        <legend>{t('customFilter.include_title')}</legend>
        <p className="custom-filter-description">{t('customFilter.include_description')}</p>
        <AutocompleteInput 
          placeholder={t('customFilter.placeholder')}
          onSelect={(selection) => dispatch({ type: 'ADD_INCLUDED_TAXON', payload: selection })}
          // La prop 'incorrectAncestorIds' est volontairement retirée.
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
      </form>

      {/* --- SECTION EXCLUSION --- */}
      <fieldset>
        <legend>{t('customFilter.exclude_title')}</legend>
        <p className="custom-filter-description">{t('customFilter.exclude_description')}</p>
        <AutocompleteInput 
          placeholder={t('customFilter.placeholder')}
          onSelect={(selection) => dispatch({ type: 'ADD_EXCLUDED_TAXON', payload: selection })}
           // La prop 'incorrectAncestorIds' est volontairement retirée.
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
      
      {/* --- SECTION LIEU ET DATE (inchangées) --- */}
      <fieldset>
        <legend>
          <label className="checkbox-label">
            <input type="checkbox" checked={filters.place_enabled} onChange={() => dispatch({ type: 'TOGGLE_PLACE' })} />
            <span className="custom-checkbox"></span>
            {t('customFilter.filter_by_place')}
          </label>
        </legend>
        {filters.place_enabled && (
          <GeoFilter value={filters.geo} onChange={(v) => dispatch({ type: 'SET_GEO', payload: v })} />
        )}
      </fieldset>

      <fieldset>
        <legend>
          <label className="checkbox-label">
            <input type="checkbox" checked={filters.date_enabled} onChange={() => dispatch({ type: 'TOGGLE_DATE' })} />
            <span className="custom-checkbox"></span>
            {t('customFilter.filter_by_date')}
          </label>
        </legend>
        {filters.date_enabled && (
          <div className="date-filters">
            <label>{t('customFilter.date_from')}</label>
            <input className="form-input" type="date" name="d1" value={filters.d1} onChange={(e) => dispatch({ type: 'SET_FILTER', payload: { name: 'd1', value: e.target.value } })} />
            <label>{t('customFilter.date_to')}</label>
            <input className="form-input" type="date" name="d2" value={filters.d2} onChange={(e) => dispatch({ type: 'SET_FILTER', payload: { name: 'd2', value: e.target.value } })} />
          </div>
        )}
      </fieldset>
    </div>
  );
}

export default CustomFilter;
