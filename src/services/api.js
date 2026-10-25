/**
 * OnePot Family Bank - API Service Layer
 * Centralized asynchronous client connecting the React frontend to the Express REST API.
 * 
 * Features:
 * - Automatic JWT bearer token attachment in request headers
 * - Normalized, clean error response handling
 * - Authentication & Session persistence in localStorage
 * - Modular API groupings: auth, family, contributions, bowls, expenses, goals, dashboard, notifications
 */

const API_BASE_URL = import.meta.env?.VITE_API_URL || '/api';
const TOKEN_KEY = 'onepot_auth_token';
const SESSION_KEY = 'onepot_user_session';

// ==========================================
// Session & Token Helpers
// ==========================================

export function getAuthToken() {
  try {
    return localStorage.getItem(TOKEN_KEY) || null;
  } catch (err) {
    return null;
  }
}

export function setAuthToken(token) {
  try {
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_KEY);
    }
  } catch (err) {
    console.error('Failed to persist auth token:', err);
  }
}

export function clearAuthToken() {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch (err) {
    console.error('Failed to clear auth token:', err);
  }
}

export function getCurrentSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (err) {
    return null;
  }
}

export function setCurrentSession(user, family, token = null) {
  try {
    const session = {
      user,
      family,
      token: token || getAuthToken(),
      timestamp: new Date().toISOString()
    };
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    if (token) setAuthToken(token);
    return session;
  } catch (err) {
    console.error('Failed to set session:', err);
    return null;
  }
}

export function clearSession() {
  try {
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(TOKEN_KEY);
  } catch (err) {
    console.error('Failed to clear session:', err);
  }
}

// ==========================================
// Core Fetch Request Wrapper
// ==========================================

async function request(endpoint, options = {}) {
  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;
  
  const headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    ...(options.headers || {})
  };

  const token = getAuthToken();
  if (token && !headers['Authorization']) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const config = {
    ...options,
    headers
  };

  if (config.body && typeof config.body === 'object' && !(config.body instanceof FormData)) {
    config.body = JSON.stringify(config.body);
  }

  let response;
  try {
    response = await fetch(url, config);
  } catch (networkError) {
    console.error(`[API Network Error] ${config.method || 'GET'} ${url}:`, networkError.message);
    throw new Error('Unable to connect to OnePot API server. Please check that the backend is running.');
  }

  // Handle CSV / Blob downloads
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('text/csv')) {
    return await response.text();
  }

  let data;
  try {
    data = await response.json();
  } catch (parseError) {
    data = { success: false, message: response.statusText || 'Unknown server response' };
  }

  if (!response.ok) {
    // 401 Unauthorized handling
    if (response.status === 401) {
      console.warn('[API Auth] Session expired or unauthorized.');
      // Keep session intact for fallback unless explicitly revoked
    }

    const errorMessage = data?.message || data?.error || `HTTP ${response.status}: ${response.statusText}`;
    const error = new Error(errorMessage);
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}

// ==========================================
// 1. User Authentication API
// ==========================================

export const authApi = {
  /**
   * Log in user with email and password
   */
  async login({ email, password, user_id }) {
    const result = await request('/auth/login', {
      method: 'POST',
      body: { email, password, user_id }
    });

    if (result.token) {
      setAuthToken(result.token);
    }
    if (result.user) {
      setCurrentSession(result.user, result.family, result.token);
    }

    return result;
  },

  /**
   * Register a new Family account & Admin Parent user
   */
  async registerFamily({ family_name, first_name, last_name, email, password, role = 'parent', avatar }) {
    const result = await request('/auth/register-family', {
      method: 'POST',
      body: { family_name, first_name, last_name, email, password, role, avatar }
    });

    if (result.token) {
      setAuthToken(result.token);
    }
    if (result.user) {
      setCurrentSession(result.user, result.family, result.token);
    }

    return result;
  },

  /**
   * Join an existing Family account as a Member/Child
   */
  async joinFamily({ family_id, invite_code, first_name, last_name, email, password, role = 'child', avatar, relationship }) {
    const result = await request('/auth/join-family', {
      method: 'POST',
      body: { family_id, invite_code, first_name, last_name, email, password, role, avatar, relationship }
    });

    if (result.token) {
      setAuthToken(result.token);
    }
    if (result.user) {
      setCurrentSession(result.user, result.family, result.token);
    }

    return result;
  },

  /**
   * Fetch current authenticated user and family info
   */
  async getMe() {
    return await request('/auth/me', { method: 'GET' });
  },

  /**
   * Update user profile & masked bank account
   */
  async updateProfile(profileData) {
    return await request('/auth/profile', {
      method: 'PUT',
      body: profileData
    });
  },

  /**
   * Change user password
   */
  async changePassword({ currentPassword, newPassword }) {
    return await request('/auth/change-password', {
      method: 'POST',
      body: { currentPassword, newPassword }
    });
  },

  /**
   * Log out and wipe local credentials
   */
  logout() {
    clearSession();
  }
};

// ==========================================
// 2. Family Pot & Contributions API
// ==========================================

export const familyApi = {
  /**
   * Get all registered families (for family selector / login screen)
   */
  async getFamilies() {
    const res = await request('/families', { method: 'GET' });
    return res.families || res.data || [];
  },

  /**
   * Get details of active family (Pot balance, total saved, monthly spend)
   */
  async getFamilyDetails() {
    const res = await request('/family/details', { method: 'GET' });
    return res.family;
  },

  /**
   * List all family members with total contributions & total spend
   */
  async getFamilyMembers() {
    const res = await request('/family/members', { method: 'GET' });
    return res.members || [];
  },

  /**
   * Update member role / relationship (Admin only)
   */
  async updateMemberRole(memberId, role, relationship) {
    return await request(`/family/members/${memberId}/role`, {
      method: 'PUT',
      body: { role, relationship }
    });
  },

  /**
   * Remove member from family (Admin only)
   */
  async removeMember(memberId) {
    return await request(`/family/members/${memberId}`, {
      method: 'DELETE'
    });
  },

  /**
   * Regenerate family invite code (Admin only)
   */
  async regenerateInviteCode() {
    return await request('/family/regenerate-invite', {
      method: 'POST'
    });
  },

  /**
   * Update family settings (e.g. auto_save_rate, name)
   */
  async updateFamilySettings(settings) {
    return await request('/family/settings', {
      method: 'PUT',
      body: settings
    });
  }
};

export const contributionsApi = {
  /**
   * Get family contribution transactions history
   */
  async getContributions(params = {}) {
    const query = new URLSearchParams(params).toString();
    const endpoint = query ? `/contributions?${query}` : '/contributions';
    const res = await request(endpoint, { method: 'GET' });
    return res.contributions || [];
  },

  /**
   * Get member pooling breakdown stats ("Dad 200k, Mum 100k, Tobi 20k...")
   */
  async getStats() {
    const res = await request('/contributions/stats', { method: 'GET' });
    return res;
  },

  /**
   * Record a direct / simulated contribution to family pot
   * (Applies 5% auto-savings to emergency fund, 95% to active pot)
   */
  async contribute({ amount, note, payment_method = 'manual' }) {
    return await request('/contributions/manual', {
      method: 'POST',
      body: { amount, note, payment_method }
    });
  },

  /**
   * Initialize Paystack contribution payment
   */
  async initializePaystack({ amount, note }) {
    return await request('/contributions/initialize', {
      method: 'POST',
      body: { amount, note }
    });
  },

  /**
   * Verify Paystack contribution by transaction reference
   */
  async verifyPaystack({ reference, amount, note }) {
    return await request('/contributions/verify', {
      method: 'POST',
      body: { reference, amount, note }
    });
  }
};

// ==========================================
// 3. Bowls Budgeting API
// ==========================================

export const bowlsApi = {
  /**
   * Get all bowls with target, allocated, spent, remaining, and alert status
   */
  async getBowls() {
    const res = await request('/bowls', { method: 'GET' });
    return res.bowls || [];
  },

  /**
   * Get unallocated pot balance for Zero-Based Budgeting checks
   */
  async getUnallocatedPot() {
    return await request('/bowls/unallocated-pot', { method: 'GET' });
  },

  /**
   * Create a new custom bowl (Admin only)
   */
  async createBowl(bowlData) {
    return await request('/bowls', {
      method: 'POST',
      body: bowlData
    });
  },

  /**
   * Update bowl details or target limit (Admin only)
   */
  async updateBowl(bowlId, bowlData) {
    return await request(`/bowls/${bowlId}`, {
      method: 'PUT',
      body: bowlData
    });
  },

  /**
   * Update spending cap / limit of a bowl
   */
  async updateBudgetLimit(bowlId, target_budget) {
    return await request(`/bowls/${bowlId}`, {
      method: 'PUT',
      body: { target_budget: Number(target_budget) }
    });
  },

  /**
   * Delete a bowl (Admin only; unspent balance returns to pot)
   */
  async deleteBowl(bowlId) {
    return await request(`/bowls/${bowlId}`, {
      method: 'DELETE'
    });
  },

  /**
   * Allocate pot funds into bowls (Admin only)
   * Modes: 'manual' | 'zero-based' | '50-30-20' | 'priority'
   */
  async allocateFunds({ mode = 'manual', allocations = [] }) {
    return await request('/bowls/allocate', {
      method: 'POST',
      body: { mode, allocations }
    });
  }
};

// ==========================================
// 4. Expenses & Requests API
// ==========================================

export const expensesApi = {
  /**
   * List all expenses / spending requests
   */
  async getExpenses(params = {}) {
    const query = new URLSearchParams(params).toString();
    const endpoint = query ? `/expenses?${query}` : '/expenses';
    const res = await request(endpoint, { method: 'GET' });
    return res.expenses || [];
  },

  /**
   * Create an expense:
   * - Admin: Auto-debits from bowl and pot immediately
   * - Member: Creates a 'pending' spending request requiring parental authorization
   */
  async createExpense({ bowl_id, amount, title, description, receipt_url }) {
    return await request('/expenses', {
      method: 'POST',
      body: { bowl_id, amount, title, description, receipt_url }
    });
  },

  /**
   * Request to borrow from the Emergency Fund when a bowl is empty
   */
  async requestEmergencyBorrow({ amount, title, description }) {
    return await request('/expenses/emergency-borrow', {
      method: 'POST',
      body: { amount, title, description }
    });
  },

  /**
   * Decide on a pending expense or emergency borrow request (Admin only)
   * Decision: 'approved' | 'rejected'
   */
  async decideExpense(expenseId, { decision, rejection_reason, comments }) {
    return await request(`/expenses/${expenseId}/decision`, {
      method: 'PUT',
      body: { decision, rejection_reason, comments }
    });
  },

  /**
   * Get single expense details with approval audit history
   */
  async getExpenseById(expenseId) {
    return await request(`/expenses/${expenseId}`, { method: 'GET' });
  }
};

// ==========================================
// 5. Goals API
// ==========================================

export const goalsApi = {
  async getGoals() {
    const res = await request('/goals', { method: 'GET' });
    return res.goals || [];
  },

  async createGoal({ title, description, target_amount, deadline, image_url }) {
    return await request('/goals', {
      method: 'POST',
      body: { title, description, target_amount, deadline, image_url }
    });
  },

  async contributeToGoal(goalId, amount) {
    return await request(`/goals/${goalId}/contribute`, {
      method: 'POST',
      body: { amount }
    });
  },

  async unlockGoal(goalId) {
    return await request(`/goals/${goalId}/unlock`, {
      method: 'PUT'
    });
  }
};

// ==========================================
// 6. Dashboard & Reports API
// ==========================================

export const dashboardApi = {
  /**
   * Get consolidated family dashboard summary (Cards, Bowls, Recent TX, Pie/Bar chart data)
   */
  async getSummary() {
    return await request('/dashboard/summary', { method: 'GET' });
  },

  /**
   * Fetch or download periodic financial report
   */
  async getReport(format = 'json') {
    return await request(`/dashboard/report?format=${format}`, { method: 'GET' });
  }
};

// ==========================================
// 7. Notifications API
// ==========================================

export const notificationsApi = {
  async getNotifications(unreadOnly = false) {
    const res = await request(`/notifications?unread_only=${unreadOnly}`, { method: 'GET' });
    return res.notifications || [];
  },

  async getUnreadCount() {
    const res = await request('/notifications/unread-count', { method: 'GET' });
    return res.unread_count || 0;
  },

  async markAsRead(notificationId) {
    return await request(`/notifications/${notificationId}/read`, { method: 'PUT' });
  },

  async markAllAsRead() {
    return await request('/notifications/read-all', { method: 'PUT' });
  }
};

// ==========================================
// 8. Mono Open Banking Sandbox API
// ==========================================

export const monoApi = {
  async linkAccount(code) {
    return await request('/mono/link', {
      method: 'POST',
      body: { code }
    });
  },

  async getLinkedAccounts() {
    const res = await request('/mono/accounts', { method: 'GET' });
    return res.accounts || [];
  }
};

// ==========================================
// Unified API Export
// ==========================================

export const api = {
  auth: authApi,
  family: familyApi,
  contributions: contributionsApi,
  bowls: bowlsApi,
  expenses: expensesApi,
  goals: goalsApi,
  dashboard: dashboardApi,
  notifications: notificationsApi,
  mono: monoApi,
  session: {
    getToken: getAuthToken,
    setToken: setAuthToken,
    clearToken: clearAuthToken,
    getCurrent: getCurrentSession,
    setCurrent: setCurrentSession,
    clear: clearSession
  }
};

export default api;

