/**
 * Utility for managing organization form state persistence using sessionStorage
 * This ensures form data is retained when navigating between pages
 */

const STORAGE_KEY = 'organization_form_data';

export interface OrganizationFormData {
  name: string;
  description?: string;
  dashboardaccess: boolean;
  module_access_list?: Array<{
    module: string;
    access: 'full_access' | 'view_only' | 'no_access';
  }>;
  selectedAdmins?: Array<{
    id: string | number;
    name: string;
    email: string;
    role: string;
  }>;
}

export const organizationFormStore = {
  /**
   * Save form data to sessionStorage
   */
  save: (data: Partial<OrganizationFormData>) => {
    try {
      const existing = organizationFormStore.get();
      const merged = { ...existing, ...data };
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
    } catch (error) {
      console.error('Failed to save organization form data:', error);
    }
  },

  /**
   * Get form data from sessionStorage
   */
  get: (): Partial<OrganizationFormData> => {
    try {
      const data = sessionStorage.getItem(STORAGE_KEY);
      return data ? JSON.parse(data) : {};
    } catch (error) {
      console.error('Failed to retrieve organization form data:', error);
      return {};
    }
  },

  /**
   * Clear form data from sessionStorage
   */
  clear: () => {
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      console.error('Failed to clear organization form data:', error);
    }
  },

  /**
   * Check if there's cached data available
   */
  hasCachedData: (): boolean => {
    try {
      const data = sessionStorage.getItem(STORAGE_KEY);
      return !!data;
    } catch (error) {
      return false;
    }
  },
};

