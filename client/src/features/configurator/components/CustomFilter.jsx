import React, { Suspense, lazy, useMemo } from 'react';
import AutocompleteInput from '../../../shared/ui/AutocompleteInput';
import { useLanguage } from '../../../context/LanguageContext.jsx';
import { getDaysInMonth, isPeriodFilterIncomplete } from '../../../utils/periodFilter';

const GeoFilter = lazy(() => import('../../../components/GeoFilter.jsx'));

const TaxonPill = React.memo(({ onRemove, label, removeLabel }) => (
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
  const { t, formatTaxonName, language } = useLanguage();
  const removeLabel = t('customFilter.remove_taxon');
  const periodIsIncomplete = isPeriodFilterIncomplete(filters);

  const monthOptions = useMemo(() => {
    const formatter = new Intl.DateTimeFormat(language, { month: 'long', timeZone: 'UTC' });
    return Array.from({ length: 12 }, (_, idx) => {
      const monthValue = String(idx + 1).padStart(2, '0');
      return {
        value: monthValue,
        label: formatter.format(new Date(Date.UTC(2000, idx, 1))),
      };
    });
  }, [language]);

  const startDayOptions = useMemo(() => {
    const totalDays = getDaysInMonth(filters.periodStartMonth);
    return Array.from({ length: totalDays }, (_, idx) => String(idx + 1).padStart(2, '0'));
  }, [filters.periodStartMonth]);

  const endDayOptions = useMemo(() => {
    const totalDays = getDaysInMonth(filters.periodEndMonth);
    return Array.from({ length: totalDays }, (_, idx) => String(idx + 1).padStart(2, '0'));
  }, [filters.periodEndMonth]);

  const updatePeriodMonth = (monthField, dayField, nextMonth, currentDay) => {
    dispatch({ type: 'SET_FILTER', payload: { name: monthField, value: nextMonth } });
    if (!nextMonth) {
      dispatch({ type: 'SET_FILTER', payload: { name: dayField, value: '' } });
      return;
    }
    if (currentDay && Number(currentDay) > getDaysInMonth(nextMonth)) {
      dispatch({ type: 'SET_FILTER', payload: { name: dayField, value: '' } });
    }
  };

  return (
    <div className="custom-filter-container">
      <FilterSection
        label={t('customFilter.filter_by_taxa')}
        
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
        
        enabled={filters.place_enabled}
        onToggle={() => dispatch({ type: 'TOGGLE_PLACE' })}
      >
        <p className="custom-filter-description">{t('customFilter.place_helper')}</p>
        <Suspense
          fallback={
            <p className="custom-filter-description">
              {t('customFilter.map_loading', {}, 'Chargement de la carte...')}
            </p>
          }
        >
          <GeoFilter value={filters.geo} onChange={(v) => dispatch({ type: 'SET_GEO', payload: v })} />
        </Suspense>
      </FilterSection>

      <FilterSection
        label={t('customFilter.filter_by_period')}
        
        enabled={filters.period_enabled}
        onToggle={() => dispatch({ type: 'TOGGLE_PERIOD' })}
      >
        <p className="custom-filter-description">{t('customFilter.period_helper')}</p>
        <div className="date-filters">
          <fieldset className="period-fieldset">
            <legend>{t('customFilter.period_from')}</legend>
            <div className="period-select-row">
              <div className="period-select-group">
                <label htmlFor="filter-period-start-month">
                  {t('customFilter.period_month', {}, 'Mois')}
                </label>
                <select
                  id="filter-period-start-month"
                  className="form-input"
                  name="periodStartMonth"
                  value={filters.periodStartMonth}
                  onChange={(e) =>
                    updatePeriodMonth(
                      'periodStartMonth',
                      'periodStartDay',
                      e.target.value,
                      filters.periodStartDay
                    )
                  }
                >
                  <option value="">{t('customFilter.period_month_placeholder', {}, 'Mois')}</option>
                  {monthOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="period-select-group">
                <label htmlFor="filter-period-start-day">
                  {t('customFilter.period_day', {}, 'Jour')}
                </label>
                <select
                  id="filter-period-start-day"
                  className="form-input"
                  name="periodStartDay"
                  value={filters.periodStartDay}
                  disabled={!filters.periodStartMonth}
                  onChange={(e) =>
                    dispatch({
                      type: 'SET_FILTER',
                      payload: { name: 'periodStartDay', value: e.target.value },
                    })
                  }
                >
                  <option value="">{t('customFilter.period_day_placeholder', {}, 'Jour')}</option>
                  {startDayOptions.map((day) => (
                    <option key={day} value={day}>
                      {day}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </fieldset>

          <fieldset className="period-fieldset">
            <legend>{t('customFilter.period_to')}</legend>
            <div className="period-select-row">
              <div className="period-select-group">
                <label htmlFor="filter-period-end-month">
                  {t('customFilter.period_month', {}, 'Mois')}
                </label>
                <select
                  id="filter-period-end-month"
                  className="form-input"
                  name="periodEndMonth"
                  value={filters.periodEndMonth}
                  onChange={(e) =>
                    updatePeriodMonth(
                      'periodEndMonth',
                      'periodEndDay',
                      e.target.value,
                      filters.periodEndDay
                    )
                  }
                >
                  <option value="">{t('customFilter.period_month_placeholder', {}, 'Mois')}</option>
                  {monthOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="period-select-group">
                <label htmlFor="filter-period-end-day">
                  {t('customFilter.period_day', {}, 'Jour')}
                </label>
                <select
                  id="filter-period-end-day"
                  className="form-input"
                  name="periodEndDay"
                  value={filters.periodEndDay}
                  disabled={!filters.periodEndMonth}
                  onChange={(e) =>
                    dispatch({
                      type: 'SET_FILTER',
                      payload: { name: 'periodEndDay', value: e.target.value },
                    })
                  }
                >
                  <option value="">{t('customFilter.period_day_placeholder', {}, 'Jour')}</option>
                  {endDayOptions.map((day) => (
                    <option key={day} value={day}>
                      {day}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </fieldset>
        </div>
        {periodIsIncomplete && (
          <p className="filter-validation-error">
            {t(
              'customFilter.period_incomplete',
              {},
              'Choisis un début et une fin pour activer ce filtre.'
            )}
          </p>
        )}
      </FilterSection>
    </div>
  );
}

export default CustomFilter;
