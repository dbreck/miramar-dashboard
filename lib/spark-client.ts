/**
 * Spark.re API Client for Next.js Dashboard
 * Based on working MCP client - HTTP-only, no MCP dependencies
 */

import { APIError, PaginatedResponse } from './types';

export class SparkAPIClient {
  private baseURL: string;
  private apiKey: string;
  private interactionTypeCache: Map<number, Map<number, string>>;
  private teamMemberCache: Map<number, Map<number, string>>;

  constructor(apiKey: string, baseURL: string = 'https://api.spark.re/v2') {
    this.baseURL = baseURL;
    this.apiKey = apiKey;
    this.interactionTypeCache = new Map();
    this.teamMemberCache = new Map();

    if (!this.apiKey) {
      throw new Error('SPARK_API_KEY is required');
    }
  }

  /**
   * Parse pagination info from Link header
   */
  private parseLinkHeader(linkHeader: string | null): {
    first?: number;
    last?: number;
    next?: number;
    prev?: number;
  } {
    const links: any = {};

    if (!linkHeader) return links;

    const parts = linkHeader.split(',');
    for (const part of parts) {
      const match = part.match(/<[^>]*[?&]page=(\d+)[^>]*>;\s*rel="(\w+)"/);
      if (match) {
        const [, pageNum, rel] = match;
        links[rel] = parseInt(pageNum, 10);
      }
    }

    return links;
  }

  /**
   * Make an authenticated request to the Spark.re API
   */
  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseURL}${endpoint}`;

    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Token token="${this.apiKey}"`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `Spark API Error (${response.status}): ${errorText}`;

      if (response.status === 401) {
        errorMessage = 'Authentication failed. Please check your API key.';
      } else if (response.status === 403) {
        errorMessage = 'Permission denied. Your API key may not have access to this resource.';
      } else if (response.status === 404) {
        errorMessage = 'Resource not found.';
      } else if (response.status === 429) {
        errorMessage = 'Rate limit exceeded. Please try again in a few moments.';
      }

      const error: APIError = {
        message: errorMessage,
        status: response.status
      };
      throw error;
    }

    return response.json();
  }

  /**
   * Make an authenticated request and return pagination metadata
   */
  private async requestWithPagination<T>(endpoint: string, options: RequestInit = {}): Promise<PaginatedResponse<T>> {
    const url = `${this.baseURL}${endpoint}`;

    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Token token="${this.apiKey}"`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `Spark API Error (${response.status}): ${errorText}`;

      if (response.status === 401) {
        errorMessage = 'Authentication failed. Please check your API key.';
      } else if (response.status === 403) {
        errorMessage = 'Permission denied.';
      } else if (response.status === 404) {
        errorMessage = 'Resource not found.';
      } else if (response.status === 429) {
        errorMessage = 'Rate limit exceeded.';
      }

      const error: APIError = {
        message: errorMessage,
        status: response.status
      };
      throw error;
    }

    const data = await response.json();
    const linkHeader = response.headers.get('link');
    const links = this.parseLinkHeader(linkHeader);

    return {
      data,
      pagination: {
        currentPage: this.extractPageFromUrl(endpoint),
        firstPage: links.first,
        lastPage: links.last,
        nextPage: links.next,
        prevPage: links.prev,
        hasMore: !!links.next,
        totalPages: links.last
      }
    };
  }

  /**
   * Extract page number from URL/endpoint
   */
  private extractPageFromUrl(url: string): number {
    const match = url.match(/[?&]page=(\d+)/);
    return match ? parseInt(match[1], 10) : 1;
  }

  /**
   * Perform a GET request
   */
  async get<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'GET' });
  }

  /**
   * Perform a GET request with pagination metadata
   */
  async getWithPagination<T>(endpoint: string): Promise<PaginatedResponse<T>> {
    return this.requestWithPagination<T>(endpoint, { method: 'GET' });
  }

  /**
   * Build query string from parameters
   */
  buildQueryString(params: Record<string, any>): string {
    const urlParams = new URLSearchParams();

    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        urlParams.append(key, String(value));
      }
    });

    const queryString = urlParams.toString();
    return queryString ? `?${queryString}` : '';
  }

  /**
   * Get interaction type ID to name mapping for a project
   */
  async getInteractionTypeMap(project_id: number): Promise<Map<number, string>> {
    if (this.interactionTypeCache.has(project_id)) {
      return this.interactionTypeCache.get(project_id)!;
    }

    const typeMap = new Map<number, string>();

    try {
      const types: any = await this.get(`/interaction-types?per_page=100`);

      let typeList: any[] = [];
      if (Array.isArray(types)) {
        typeList = types;
      } else if (types && types.data && Array.isArray(types.data)) {
        typeList = types.data;
      }

      typeList.forEach((type: any) => {
        if (type.id && type.value) {
          typeMap.set(type.id, type.value);
        } else if (type.id && type.name) {
          typeMap.set(type.id, type.name);
        }
      });
    } catch (error) {
      console.error('Failed to fetch interaction types:', error);
    }

    this.interactionTypeCache.set(project_id, typeMap);
    return typeMap;
  }

  /**
   * Get team member ID to name mapping for a project
   */
  async getTeamMemberMap(project_id: number): Promise<Map<number, string>> {
    if (this.teamMemberCache.has(project_id)) {
      return this.teamMemberCache.get(project_id)!;
    }

    const memberMap = new Map<number, string>();

    try {
      const members: any = await this.get(`/team-members?per_page=100`);

      let memberList: any[] = [];
      if (Array.isArray(members)) {
        memberList = members;
      } else if (members && members.data && Array.isArray(members.data)) {
        memberList = members.data;
      }

      memberList.forEach((member: any) => {
        if (member.id) {
          const name = `${member.first_name || ''} ${member.last_name || ''}`.trim() || `Team Member ${member.id}`;
          memberMap.set(member.id, name);
        }
      });
    } catch (error) {
      console.error('Failed to fetch team members:', error);
    }

    this.teamMemberCache.set(project_id, memberMap);
    return memberMap;
  }

  /**
   * List all projects
   */
  async listProjects(): Promise<any> {
    return this.get('/projects?per_page=100');
  }

  /**
   * Get project details
   */
  async getProject(projectId: number): Promise<any> {
    return this.get(`/projects/${projectId}`);
  }

  /**
   * List contacts with filters
   */
  async listContacts(params: Record<string, any> = {}): Promise<any> {
    const query = this.buildQueryString(params);
    return this.get(`/contacts${query}`);
  }

  /**
   * List interactions with filters (single page)
   */
  async listInteractions(params: Record<string, any> = {}): Promise<any> {
    const query = this.buildQueryString(params);
    return this.get(`/interactions${query}`);
  }

  /**
   * List ALL interactions with automatic pagination
   * Fetches all pages until no more results
   */
  async listAllInteractions(params: Record<string, any> = {}): Promise<any[]> {
    const allInteractions: any[] = [];
    let page = 1;
    let hasMore = true;
    const maxPages = 50; // Safety limit

    console.log('Fetching ALL interactions with pagination...');

    while (hasMore && page <= maxPages) {
      const pageParams = { ...params, page, per_page: 100 };
      const query = this.buildQueryString(pageParams);

      try {
        const response = await this.get<any>(`/interactions${query}`);
        const interactions = Array.isArray(response) ? response : response.data || [];

        if (interactions.length === 0) {
          break;
        }

        allInteractions.push(...interactions);
        console.log(`  Page ${page}: Fetched ${interactions.length} interactions (total: ${allInteractions.length})`);

        // Check if there are more pages (if we got 100, there might be more)
        hasMore = interactions.length === 100;
        page++;
      } catch (error) {
        console.error(`Failed to fetch interactions page ${page}:`, error);
        break;
      }
    }

    console.log(`Finished fetching all interactions: ${allInteractions.length} total`);
    return allInteractions;
  }

  /**
   * List ALL contacts with automatic pagination
   * Fetches all pages until no more results
   * Supports date filtering via created_at_gteq and created_at_lteq
   */
  async listAllContacts(params: Record<string, any> = {}): Promise<any[]> {
    const allContacts: any[] = [];
    let page = 1;
    let hasMore = true;
    const maxPages = 50; // Safety limit (5,000 contacts)

    console.log('Fetching ALL contacts with pagination...');

    while (hasMore && page <= maxPages) {
      const pageParams = { ...params, page, per_page: 100 };
      const query = this.buildQueryString(pageParams);

      try {
        const response = await this.get<any>(`/contacts${query}`);
        const contacts = Array.isArray(response) ? response : response.data || [];

        if (contacts.length === 0) {
          break;
        }

        allContacts.push(...contacts);
        console.log(`  Page ${page}: Fetched ${contacts.length} contacts (total: ${allContacts.length})`);

        // Check if there are more pages (if we got 100, there might be more)
        hasMore = contacts.length === 100;
        page++;
      } catch (error) {
        console.error(`Failed to fetch contacts page ${page}:`, error);
        break;
      }
    }

    console.log(`Finished fetching all contacts: ${allContacts.length} total`);
    return allContacts;
  }

  /**
   * Get contact details
   */
  async getContact(contactId: number): Promise<any> {
    return this.get(`/contacts/${contactId}`);
  }

  /**
   * List interaction types
   */
  async listInteractionTypes(): Promise<any> {
    return this.get('/interaction-types?per_page=100');
  }

  /**
   * List team members
   */
  async listTeamMembers(): Promise<any> {
    return this.get('/team-members?per_page=100');
  }

  /**
   * List registration sources (lead sources)
   */
  async listRegistrationSources(params: Record<string, any> = {}): Promise<any> {
    const query = this.buildQueryString(params);
    return this.get(`/registration-sources${query}`);
  }
}
