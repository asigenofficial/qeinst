/**
 * QEINST REST API Client (PHP + Laravel Backend Integration)
 */
const QEI_API_BASE = window.QEI_API_URL || (function() {
	if (typeof window !== 'undefined' && window.location) {
		const host = window.location.hostname;
		// Allow file:/// or localhost to hit the local Laravel API
		if (!host || host === 'localhost' || host === '127.0.0.1') {
			return 'http://127.0.0.1:8000/api/v1';
		}
		// Live / Production Server fallback
		return window.location.origin + '/api/v1';
	}
	return 'http://127.0.0.1:8000/api/v1';
})();

const QEIAPI = {
	/**
	 * General fetch wrapper with JSON error handling
	 */
	async request(endpoint, options = {}) {
		const defaultHeaders = {
			'Accept': 'application/json',
		};

		try {
			const token = localStorage.getItem('qei_token');
			if (token) defaultHeaders['Authorization'] = `Bearer ${token}`;
		} catch (e) { }

		if (!(options.body instanceof FormData)) {
			defaultHeaders['Content-Type'] = 'application/json';
		}

		const config = {
			...options,
			headers: {
				...defaultHeaders,
				...options.headers,
			},
		};

		try {
			const response = await fetch(`${QEI_API_BASE}${endpoint}`, config);
			const data = await response.json();

			if (!response.ok) {
				throw new Error(data.message || 'حدث خطأ أثناء الاتصال بالسيرفر');
			}

			return data;
		} catch (error) {
			console.error(`[QEI API Error] ${endpoint}:`, error);
			throw error;
		}
	},

	/**
	 * 1. Auth & Login API (تسجيل الدخول وإنشاء الحسابات)
	 */
	async login(loginIdentifier, password) {
		return this.request('/auth/login', {
			method: 'POST',
			body: JSON.stringify({ login: loginIdentifier, password: password })
		});
	},

	async registerStudent(studentData) {
		return this.request('/auth/register', {
			method: 'POST',
			body: JSON.stringify(studentData)
		});
	},

	async logout() {
		return this.request('/auth/logout', { method: 'POST' });
	},

	/**
	 * 0. Categories API
	 */
	async getCategories() {
		return this.request('/categories', { method: 'GET' });
	},

	/**
	 * 2. Programs & Courses API
	 */
	async getPrograms(filters = {}) {
		const query = new URLSearchParams(filters).toString();
		const endpoint = `/programs${query ? '?' + query : ''}`;
		return this.request(endpoint, { method: 'GET' });
	},

	async getProgramBySlug(slug) {
		return this.request(`/programs/${slug}`, { method: 'GET' });
	},

	/**
	 * 3. Individual Student Registration API
	 */
	async submitRegistration(formData) {
		return this.request('/registrations', {
			method: 'POST',
			body: JSON.stringify(formData),
		});
	},

	/**
	 * 4. Corporate & Custom Training Request API
	 */
	async getCorporateSolutions(filters = {}) {
		const query = new URLSearchParams(filters).toString();
		const endpoint = `/corporate-solutions${query ? '?' + query : ''}`;
		return this.request(endpoint, { method: 'GET' });
	},

	async submitCorporateRequest(formDataOrObject) {
		const isFormData = formDataOrObject instanceof FormData;
		return this.request('/corporate-requests', {
			method: 'POST',
			body: isFormData ? formDataOrObject : JSON.stringify(formDataOrObject),
		});
	},

	/**
	 * 5. Contact & Support Message API
	 */
	async submitContactMessage(contactData) {
		return this.request('/contact', {
			method: 'POST',
			body: JSON.stringify(contactData),
		});
	},


	/**
	 * 6. Gallery API (معرض الصور والفعاليات)
	 */
	async getGalleries(filters = {}) {
		const query = new URLSearchParams(filters).toString();
		const endpoint = `/galleries${query ? '?' + query : ''}`;
		return this.request(endpoint, { method: 'GET' });
	},

	/**
	 * 7. Clients & Partners API (العملاء والشركاء)
	 */
	async getClients(filters = {}) {
		const query = new URLSearchParams(filters).toString();
		const endpoint = `/clients${query ? '?' + query : ''}`;
		return this.request(endpoint, { method: 'GET' });
	},

	/**
	 * 8. Success Stories & Impact API (قصص النجاح والأثر)
	 */
	async getSuccessStories() {
		return this.request('/success-stories', { method: 'GET' });
	}
};

window.QEIAPI = QEIAPI;
