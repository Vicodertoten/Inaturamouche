import React from 'react';
import AutocompleteInput from './AutocompleteInput';
import MapFilter from './MapFilter';

const TaxonPill = ({ taxon, onRemove }) => (
  <div className="taxon-pill">
    <span>{taxon.name}</span>
    <button onClick={onRemove} className="remove-btn" title="Retirer ce taxon">×</button>
  </div>
);

function CustomFilter({ filters, dispatch }) {

  // Nous n'avons plus besoin de créer les listes d'IDs ici.

  return (
    <div className="custom-filter-container">
      {/* --- SECTION INCLUSION --- */}
      <fieldset>
        <legend>Taxons à INCLURE</legend>
        <p className="custom-filter-description">Ajoutez les groupes que vous souhaitez voir dans le quiz.</p>
        <AutocompleteInput 
          placeholder="Rechercher un taxon à inclure..."
          onSelect={(selection) => dispatch({ type: 'ADD_INCLUDED_TAXON', payload: selection })}
          // La prop 'incorrectAncestorIds' est volontairement retirée.
        />
        <div className="pills-container include-pills">
          {filters.includedTaxa.map(taxon => (
            <TaxonPill 
              key={taxon.id} 
              taxon={taxon}
              onRemove={() => dispatch({ type: 'REMOVE_INCLUDED_TAXON', payload: taxon.id })}
            />
          ))}
        </div>
      </fieldset>

      {/* --- SECTION EXCLUSION --- */}
      <fieldset>
        <legend>Taxons à EXCLURE</legend>
        <p className="custom-filter-description">Ajoutez les groupes que vous souhaitez retirer du quiz.</p>
        <AutocompleteInput 
          placeholder="Rechercher un taxon à exclure..."
          onSelect={(selection) => dispatch({ type: 'ADD_EXCLUDED_TAXON', payload: selection })}
           // La prop 'incorrectAncestorIds' est volontairement retirée.
        />
        <div className="pills-container exclude-pills">
          {filters.excludedTaxa.map(taxon => (
            <TaxonPill 
              key={taxon.id} 
              taxon={taxon}
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
            Filtrer par Lieu
          </label>
        </legend>
        {filters.place_enabled && <MapFilter filters={filters} dispatch={dispatch} />}
      </fieldset>

      <fieldset>
        <legend>
          <label className="checkbox-label">
            <input type="checkbox" checked={filters.date_enabled} onChange={() => dispatch({ type: 'TOGGLE_DATE' })} />
            <span className="custom-checkbox"></span>
            Filtrer par Date
          </label>
        </legend>
        {filters.date_enabled && (
          <div className="date-filters">
            <label>Du</label>
            <input className="form-input" type="date" name="d1" value={filters.d1} onChange={(e) => dispatch({ type: 'SET_FILTER', payload: { name: 'd1', value: e.target.value } })} />
            <label>Au</label>
            <input className="form-input" type="date" name="d2" value={filters.d2} onChange={(e) => dispatch({ type: 'SET_FILTER', payload: { name: 'd2', value: e.target.value } })} />
          </div>
        )}
      </fieldset>
    </div>
  );
}

export default CustomFilter;