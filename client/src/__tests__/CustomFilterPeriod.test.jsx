import React, { useReducer } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import CustomFilter from '../features/configurator/components/CustomFilter';
import { customFilterReducer, initialCustomFilters } from '../state/filterReducer';

vi.mock('../context/LanguageContext.jsx', () => ({
  useLanguage: () => ({
    language: 'fr',
    t: (key, _values, fallback) =>
      (
        {
          'customFilter.filter_by_period': 'Filtrer par période d’observation',
          'customFilter.period_from': 'Début',
          'customFilter.period_to': 'Fin',
        }[key]
      ) || fallback || key,
    formatTaxonName: (taxon) => taxon?.name || '',
  }),
}));

function PeriodFilterHarness() {
  const [filters, dispatch] = useReducer(customFilterReducer, initialCustomFilters);
  return <CustomFilter filters={filters} dispatch={dispatch} />;
}

describe('CustomFilter period inputs', () => {
  it('shows an inline validation message while the period filter is incomplete', () => {
    render(<PeriodFilterHarness />);

    fireEvent.click(screen.getByLabelText('Filtrer par période d’observation'));

    expect(
      screen.getByText('Choisis un début et une fin pour activer ce filtre.')
    ).toBeInTheDocument();
  });

  it('uses month/day selects and clears an invalid day when the month changes', () => {
    render(<PeriodFilterHarness />);

    fireEvent.click(screen.getByLabelText('Filtrer par période d’observation'));

    const startMonth = screen.getByLabelText('Mois', { selector: '#filter-period-start-month' });
    const startDay = screen.getByLabelText('Jour', { selector: '#filter-period-start-day' });
    const endMonth = screen.getByLabelText('Mois', { selector: '#filter-period-end-month' });
    const endDay = screen.getByLabelText('Jour', { selector: '#filter-period-end-day' });

    fireEvent.change(startMonth, { target: { value: '01' } });
    fireEvent.change(startDay, { target: { value: '31' } });
    expect(startDay).toHaveValue('31');

    fireEvent.change(startMonth, { target: { value: '02' } });
    expect(startDay).toHaveValue('');

    fireEvent.change(startDay, { target: { value: '29' } });
    fireEvent.change(endMonth, { target: { value: '03' } });
    fireEvent.change(endDay, { target: { value: '10' } });

    expect(screen.queryByText('Choisis un début et une fin pour activer ce filtre.')).toBeNull();
  });
});
