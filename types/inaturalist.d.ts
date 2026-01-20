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
  default_photo?: InatPhoto; // Add default_photo
  url?: string; // Add iNaturalist page URL
  iconic_taxon_id?: number;
  observations_count?: number;
  conservation_status?: {
    status?: string;
    status_name?: string;
    authority?: string;
  };
}

export interface InatObservation {
  id: number;
  uri?: string;
  taxon: InatTaxon;
  photos: InatPhoto[];
  sounds?: InatSound[];
}
