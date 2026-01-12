export interface InatPhoto {
  id: number;
  url: string;
  attribution?: string;
}

export interface InatSound {
  id: number;
  file_url: string;
  attribution?: string;
  license_code?: string;
}

export interface InatTaxon {
  id: number;
  name?: string;
  preferred_common_name?: string;
  common_name?: string;
  rank?: string;
  wikipedia_url?: string;
  ancestor_ids?: number[];
  ancestors?: Array<{ id: number; name?: string }>;
}

export interface InatObservation {
  id: number;
  uri?: string;
  taxon: InatTaxon;
  photos: InatPhoto[];
  sounds?: InatSound[];
}
