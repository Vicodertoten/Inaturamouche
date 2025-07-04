export const initialCustomFilters = {
  includedTaxa: [],
  excludedTaxa: [],
  place_enabled: false,
  lat: 46.6, lng: 1.88, radius: 100,
  date_enabled: false, d1: '', d2: ''
};

export function customFilterReducer(state, action) {
  switch (action.type) {
    case 'ADD_INCLUDED_TAXON':
      if (state.includedTaxa.some(t => t.id === action.payload.id)) return state;
      return { ...state, includedTaxa: [...state.includedTaxa, action.payload] };
    case 'REMOVE_INCLUDED_TAXON':
      return { ...state, includedTaxa: state.includedTaxa.filter(t => t.id !== action.payload) };
    case 'ADD_EXCLUDED_TAXON':
      if (state.excludedTaxa.some(t => t.id === action.payload.id)) return state;
      return { ...state, excludedTaxa: [...state.excludedTaxa, action.payload] };
    case 'REMOVE_EXCLUDED_TAXON':
      return { ...state, excludedTaxa: state.excludedTaxa.filter(t => t.id !== action.payload) };
    case 'TOGGLE_PLACE':
      return { ...state, place_enabled: !state.place_enabled };
    case 'TOGGLE_DATE':
      return { ...state, date_enabled: !state.date_enabled };
    case 'SET_AREA':
      return { ...state, lat: action.payload.lat, lng: action.payload.lng, radius: action.payload.radius };
    case 'SET_FILTER': 
      return { ...state, [action.payload.name]: action.payload.value };
    default:
      return state;
  }
}