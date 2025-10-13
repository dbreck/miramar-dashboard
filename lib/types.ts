/**
 * Spark.re API Types
 */

export interface APIError {
  message: string;
  status: number;
}

export interface PaginatedResponse<T> {
  data: T;
  pagination: {
    currentPage: number;
    firstPage?: number;
    lastPage?: number;
    nextPage?: number;
    prevPage?: number;
    hasMore: boolean;
    totalPages?: number;
  };
}

export interface Contact {
  id: number;
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  rating?: string;
  lead_source?: string;
  created_at?: string;
  updated_at?: string;
  last_interaction_at?: string;
}

export interface Interaction {
  id: number;
  contact_id: number;
  interaction_type_id?: number;
  interaction_type?: {
    id: number;
    value?: string;
    name?: string;
  };
  team_member_id?: number;
  date?: string;
  created_at?: string;
  notes?: string;
}

export interface Project {
  id: number;
  name: string;
  type?: string;
  stage?: string;
  location?: string;
}

export interface InteractionType {
  id: number;
  value: string;
  name?: string;
}

export interface TeamMember {
  id: number;
  first_name: string;
  last_name: string;
  email?: string;
}

export interface LeadSource {
  name: string;
  contacts: number;
  quality: number;
  engagement: number;
  email: number;
}
