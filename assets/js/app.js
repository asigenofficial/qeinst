// Quality Experts Institute for Training (QEI) - Application Logic

/* ==========================================================================
   Site root resolver
   Pages now live in section folders (about/, programs/, policies/, ...), so any
   URL built inside JS must be resolved against the site root instead of the
   current folder. app.js always sits at <root>/assets/js/app.js, so its own
   <script> element tells us where the root is - this stays correct no matter
   how deep the page is, and no matter which subdirectory the site is hosted in.
   ========================================================================== */
const QEI_ROOT = (function () {
	const self =
		document.currentScript ||
		Array.prototype.find.call(document.getElementsByTagName("script"), (s) => /assets\/js\/app\.js(\?|$)/.test(s.src))
	return self ? self.src.replace(/assets\/js\/app\.js.*$/, "") : ""
})()

// Auto-load API client if not explicitly loaded
let QEI_API_READY = Promise.resolve(window.QEIAPI || null)
if (!window.QEIAPI) {
	QEI_API_READY = new Promise((resolve) => {
		const apiScript = document.createElement("script")
		apiScript.src = QEI_ROOT + "assets/js/api-client.js"
		apiScript.onload = () => resolve(window.QEIAPI || null)
		apiScript.onerror = () => resolve(null)
		document.head.appendChild(apiScript)
	})
}

async function qeiWaitForAPI(timeoutMs = 2500) {
	if (window.QEIAPI) return window.QEIAPI
	return Promise.race([
		QEI_API_READY,
		new Promise(resolve => setTimeout(() => resolve(window.QEIAPI || null), timeoutMs))
	])
}

/** Resolve a site-root-relative path or absolute URL to a usable site URL. */
function qeiUrl(path) {
	if (!path) return "";
	if (String(path).startsWith("http://") || String(path).startsWith("https://")) return path;
	return QEI_ROOT + String(path).replace(/^\/+/, "");
}

/** Resolve program images against the FRONTEND root, even when the API returns
 * an absolute backend URL such as http://127.0.0.1:8000/assets/.... */
function qeiProgramImageUrl(path) {
	if (!path) return qeiUrl("assets/images/programs/course-placeholder.jpg");
	const value = String(path).trim();
	const assetsMatch = value.match(/(?:https?:\/\/[^/]+)?\/?(assets\/.*)$/i);
	if (assetsMatch) return qeiUrl(assetsMatch[1]);
	if (/^https?:\/\//i.test(value) || /^data:/i.test(value) || /^blob:/i.test(value)) return value;
	return qeiUrl(value.replace(/^\.\.\//, ""));
}

function qeiEscapeHTML(value) {
	return String(value ?? "")
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#039;")
}

function qeiNormalizeText(value) {
	return String(value ?? "")
		.toLowerCase()
		.normalize("NFKD")
		.replace(/[\u064B-\u065F\u0670]/g, "")
		.replace(/[أإآ]/g, "ا")
		.replace(/ى/g, "ي")
		.replace(/ة/g, "ه")
		.replace(/\s+/g, " ")
		.trim()
}

const QEI = {
	categories: [],
	programs: [],
	trainers: [],
	faqs: [],

	policies: {
		general_privacy: {
			title: "سياسة الخصوصية العامة",
			updated: "2024-05-01",
			content: `<p>يلتزم معهد خبراء الجودة للتدريب وحماية خصوصية بيانات جميع زوار المستفيدين والمتدربين وفقًا للأنظمة واللوائح الخاصة بحماية البيانات الشخصية في المملكة العربية السعودية.</p>`,
		},
	},

	init() {
		this.setupNavigation()
		this.setupProgramFilters()
		this.fetchLiveCategoriesFromDatabase()
		this.fetchLiveProgramsFromDatabase()
		this.fetchLiveClientsFromDatabase()
		this.fetchLiveSuccessStoriesFromDatabase()
		this.fetchLiveGalleryFromDatabase()
		this.renderTrainersGrid()
		this.renderCorporateSolutions()
		this.renderCorporateSolutionDetails()
		this.setupSectorInteractions()
		this.setupSearch()
		this.setupAccordions()
		this.setupModals()
		this.setupPolicies()

		// Multipage build: each screen is its own .html file, so the legacy hash
		// router must stay switched off (it would hide the page section).
		if (document.body.dataset.multipage !== "1") {
			window.addEventListener("hashchange", () => this.handleRoute())
			this.handleRoute()
		}
	},

	async fetchLiveCategoriesFromDatabase() {
		const executeFetch = async () => {
			if (!window.QEIAPI || typeof window.QEIAPI.getCategories !== "function") return;
			try {
				const res = await window.QEIAPI.getCategories();
				if (res && res.status && Array.isArray(res.data) && res.data.length > 0) {
					this.categories = res.data;
					this.renderCategoryFilters();
					this.updateCatalogMetric('categories', this.categories.length);
					const catalogProgramCount = this.categories.reduce((sum, category) => sum + Number(category.programs_count || 0), 0);
					if (catalogProgramCount > 0) this.updateCatalogMetric('programs', catalogProgramCount);
				}
			} catch (err) {
				console.warn('[QEI] Could not fetch categories from backend database.', err);
			}
		};

		if (window.QEIAPI) {
			executeFetch();
		} else {
			let attempts = 0;
			const pollTimer = setInterval(() => {
				attempts++;
				if (window.QEIAPI) {
					clearInterval(pollTimer);
					executeFetch();
				} else if (attempts > 30) {
					clearInterval(pollTimer);
				}
			}, 50);
		}
	},

	renderCategoryFilters() {
		const filterSection = document.getElementById("categoryFilterList")
		if (filterSection && this.categories.length) {
			filterSection.innerHTML = this.categories.map(c => `
				<label>
					<input type="checkbox" data-filter-group="category" data-category-id="${c.id}" value="${qeiEscapeHTML(c.slug)}" />
					<span>${qeiEscapeHTML(c.icon || '🏷️')} ${qeiEscapeHTML(c.name)}</span>
					<small>${Number(c.programs_count || 0)}</small>
				</label>
			`).join("")
		}

		const homeSelect = document.getElementById("homeSearchCategorySelect")
		if (homeSelect && this.categories.length) {
			homeSelect.innerHTML = `<option value="">جميع المجالات</option>` + this.categories.map(c => `
				<option value="${qeiEscapeHTML(c.slug)}">${qeiEscapeHTML(c.icon || '')} ${qeiEscapeHTML(c.name)}</option>
			`).join("")
		}

		this.syncProgramFiltersFromUrl()
	},


	updateCatalogMetric(name, value) {
		const number = Number(value)
		if (!Number.isFinite(number)) return
		document.querySelectorAll(`[data-qei-metric="${name}"]`).forEach(el => {
			el.textContent = new Intl.NumberFormat('ar-SA').format(number)
		})
	},

	async fetchLiveProgramsFromDatabase() {
		const targetGrid = document.getElementById("allProgramsGrid") || document.getElementById("featuredProgramsGrid");
		if (targetGrid && window.showSkeleton) window.showSkeleton(targetGrid);

		const executeFetch = async () => {
			if (!window.QEIAPI || typeof window.QEIAPI.getPrograms !== "function") return
			try {
				const isHomePage = !!document.getElementById("featuredProgramsGrid")
				const res = await window.QEIAPI.getPrograms(isHomePage ? { featured: 1, limit: 8 } : {})
				if (!res || !res.status || !Array.isArray(res.data)) {
					if (targetGrid && window.restoreSkeleton) window.restoreSkeleton(targetGrid);
					return;
				}

				this.programs = res.data.map(p => {
					const schedules = Array.isArray(p.schedules) ? p.schedules : []
					const modes = [...new Set(schedules.flatMap(schedule => {
						const raw = String(schedule.execution_mode || "")
						return raw.split(/\s*[/|،]\s*/).map(v => v.trim()).filter(Boolean)
					}).map(mode => mode.replace(/عن بعد/g, "عن بُعد")))]
					const firstSchedule = schedules[0] || null
					const rawImage = p.image || p.image_url || 'assets/images/programs/course-placeholder.jpg'

					return {
						id: String(p.id),
						slug: p.slug || String(p.id),
						title: p.title || '',
						category: p.category ? p.category.name : 'غير مصنف',
						categorySlug: p.category ? p.category.slug : '',
						categoryId: p.category ? String(p.category.id) : String(p.category_id || ''),
						level: p.level || 'الكل',
						modes,
						mode: modes.length ? modes.join(' / ') : 'يحدد عند الجدولة',
						location: firstSchedule && firstSchedule.location ? firstSchedule.location : '',
						durationDays: Number(p.duration_days || 0),
						durationHours: Number(p.duration_hours || 0),
						duration: `${Number(p.duration_days || 0)} أيام • ${Number(p.duration_hours || 0)} ساعة`,
						image: rawImage,
						imageUrl: qeiProgramImageUrl(rawImage),
						isFeatured: Boolean(p.is_featured),
						desc: p.summary || p.description || '',
						description: p.description || p.summary || '',
						status: 'available',
						schedules,
						batches: schedules.map(schedule => ({
							id: schedule.id,
							date: `${String(schedule.start_date || '').split('T')[0]} - ${String(schedule.end_date || '').split('T')[0]}`,
							time: '',
							location: schedule.location || schedule.execution_mode || '',
							execution_mode: schedule.execution_mode || '',
							status: schedule.status || 'متاح',
						})),
					}
				})

				if (!isHomePage) this.updateCatalogMetric('programs', this.programs.length)
				const executionModes = new Set(this.programs.flatMap(program => program.modes || []))
				if (executionModes.size > 0) this.updateCatalogMetric('modes', executionModes.size)

				this.renderFeaturedPrograms()
				this.renderAllPrograms()
				this.renderCalendarPrograms()
				this.renderProgramDetailsPage()
				this.renderScheduleSelection()
			} catch (err) {
				console.warn('[QEI] تعذر تحميل البرامج من واجهة API.', err)
				if (targetGrid && window.restoreSkeleton) window.restoreSkeleton(targetGrid);
			}
		}

		if (window.QEIAPI) {
			executeFetch()
		} else {
			let attempts = 0
			const pollTimer = setInterval(() => {
				attempts++
				if (window.QEIAPI) {
					clearInterval(pollTimer)
					executeFetch()
				} else if (attempts > 30) {
					clearInterval(pollTimer)
				}
			}, 50)
		}
	},

	async fetchLiveClientsFromDatabase() {
		const executeFetch = async () => {
			if (!window.QEIAPI || typeof window.QEIAPI.getClients !== "function") return
			try {
				const res = await window.QEIAPI.getClients()
				if (res && res.status && Array.isArray(res.data)) {
					this.renderHomePartners(res.data)
					this.renderClientsPageGrid(res.data)
					this.updateCatalogMetric('clients', res.data.length)
				}
			} catch (err) {
				console.warn('[QEI] تعذر تحميل العملاء والشركاء من واجهة API.', err)
			}
		}

		if (window.QEIAPI) executeFetch()
		else {
			let attempts = 0
			const timer = setInterval(() => {
				attempts++
				if (window.QEIAPI) { clearInterval(timer); executeFetch() }
				else if (attempts > 30) clearInterval(timer)
			}, 50)
		}
	},


	async fetchLiveSuccessStoriesFromDatabase() {
		const grid = document.getElementById('homeSuccessGrid')
		if (!grid) return

		const executeFetch = async () => {
			if (!window.QEIAPI || typeof window.QEIAPI.getSuccessStories !== 'function') return
			try {
				const res = await window.QEIAPI.getSuccessStories()
				if (!res || !res.status || !Array.isArray(res.data) || !res.data.length) return
				grid.innerHTML = res.data.slice(0, 3).map(story => {
					const rawImage = story.image || story.image_url || 'assets/images/gallery/gallery-list-1.jpg'
					const image = String(rawImage).startsWith('http') ? rawImage : qeiUrl(rawImage)
					return `
						<article>
							<img src="${qeiEscapeHTML(image)}" alt="${qeiEscapeHTML(story.title)}" loading="lazy" />
							<h3>${qeiEscapeHTML(story.title)}</h3>
							<p>${qeiEscapeHTML(story.quote_or_description || '')}</p>
						</article>
					`
				}).join('')
			} catch (err) {
				console.warn('[QEI] تعذر تحميل نماذج الأثر المؤسسي من واجهة API.', err)
			}
		}

		if (window.QEIAPI) executeFetch()
		else {
			let attempts = 0
			const timer = setInterval(() => {
				attempts++
				if (window.QEIAPI) { clearInterval(timer); executeFetch() }
				else if (attempts > 30) clearInterval(timer)
			}, 50)
		}
	},

	async fetchLiveGalleryFromDatabase() {
		const grid = document.getElementById('homeGalleryGrid')
		if (!grid) return
		const executeFetch = async () => {
			if (!window.QEIAPI || typeof window.QEIAPI.getGalleries !== 'function') return
			try {
				const res = await window.QEIAPI.getGalleries({ type: 'image' })
				if (!res || !res.status || !Array.isArray(res.data) || !res.data.length) return
				const items = res.data.slice(0, 8)
				grid.innerHTML = items.map(item => {
					const raw = item.media_path || item.cover_image || ''
					const src = String(raw).startsWith('http') ? raw : qeiUrl(raw)
					return `<a class="home-gallery-item" href="${qeiUrl('gallery/gallery.html')}">
						<img src="${qeiEscapeHTML(src)}" alt="${qeiEscapeHTML(item.title || 'من أجواء التدريب')}" loading="lazy" decoding="async">
					</a>`
				}).join('')
			} catch (err) {
				console.warn('[QEI] تعذر تحميل معرض الرئيسية من قاعدة البيانات.', err)
			}
		}
		if (window.QEIAPI) executeFetch()
		else {
			let attempts = 0
			const timer = setInterval(() => {
				attempts++
				if (window.QEIAPI) { clearInterval(timer); executeFetch() }
				else if (attempts > 30) clearInterval(timer)
			}, 50)
		}
	},

	renderClientsPageGrid(clients) {
		const grid = document.getElementById('partnerGrid')
		if (!grid || grid.dataset.dbDriven !== 'clients' || !Array.isArray(clients) || !clients.length) return
		grid.innerHTML = clients.map(client => {
			const raw = client.logo || client.logo_url || ''
			const src = String(raw).startsWith('http') ? raw : qeiUrl(raw)
			return `<article data-category="${qeiEscapeHTML(client.type || 'عميل')}" title="${qeiEscapeHTML(client.name)}">
				<img class="partner-logo-img" src="${qeiEscapeHTML(src)}" alt="${qeiEscapeHTML(client.name)}" loading="lazy" decoding="async">
			</article>`
		}).join('')
	},

	setupSectorInteractions() {
		// Final UX: sector cards are informational only. The dedicated "استعراض جميع القطاعات" link handles navigation.
		// No explanatory panel is injected below the sector grid.
	},

	async renderCorporateSolutionDetails() {
		const page = document.getElementById('corporateSolutionDetails')
		if (!page) return
		const slug = new URLSearchParams(window.location.search).get('slug') || 'training-needs'
		const render = (solution) => {
			if (!solution) return
			const title = document.getElementById('csTitle')
			const summary = document.getElementById('csSummary')
			const description = document.getElementById('csDescription')
			const image = document.getElementById('csImage')
			if (title) title.textContent = solution.title || ''
			if (summary) summary.textContent = solution.summary || ''
			if (description) description.textContent = solution.description || solution.summary || ''
			if (image) {
				const raw = solution.image || 'assets/images/solutions/solutions-hero.jpeg'
				image.src = String(raw).startsWith('http') ? raw : qeiUrl(raw)
				image.alt = solution.title || 'حل مؤسسي'
			}
			document.title = `${solution.title || 'حلول المؤسسات'} | QEI — معهد خبراء الجودة للتدريب`
			page.classList.add('qei-data-ready')
		}
		const executeFetch = async () => {
			if (!window.QEIAPI || typeof window.QEIAPI.getCorporateSolutions !== 'function') return
			try {
				const res = await window.QEIAPI.getCorporateSolutions()
				const item = res && res.status && Array.isArray(res.data) ? res.data.find(x => String(x.slug) === String(slug)) : null
				render(item)
			} catch (err) {
				console.warn('[QEI] تعذر تحميل تفاصيل الحل المؤسسي.', err)
			}
		}
		const api = await qeiWaitForAPI()
		if (api) executeFetch()
		else page.classList.add('qei-data-ready') // keep the built-in fallback visible offline
	},

	renderHomePartners(clients) {
		const track = document.getElementById('homePartnersTrack')
		if (!track || !Array.isArray(clients) || !clients.length) return
		const itemHTML = clients.map(client => {
			const rawLogo = client.logo || client.logo_url || ''
			const logo = String(rawLogo).startsWith('http') ? rawLogo : qeiUrl(rawLogo)
			return `<div class="partner-ticker-item"><img src="${qeiEscapeHTML(logo)}" alt="${qeiEscapeHTML(client.name)}" loading="lazy" /></div>`
		}).join('')
		track.innerHTML = itemHTML + itemHTML
	},

	handleRoute() {
		if (document.body.dataset.multipage === "1") return
		const hash = window.location.hash || "#home"
		const pages = document.querySelectorAll(".page-view")
		pages.forEach((p) => (p.style.display = "none"))

		const navLinks = document.querySelectorAll("nav.main-nav a")
		navLinks.forEach((a) => a.classList.remove("active"))

		let targetPage = "home"
		if (hash.startsWith("#program/")) {
			const id = hash.split("/")[1]
			const prg = this.programs.find((p) => p.id === id)
			if (prg && prg.status === "closed") {
				this.showClosedProgram(prg)
				targetPage = "closed-program"
			} else {
				this.showProgramDetails(id)
				targetPage = "program-details"
			}
		} else if (hash.startsWith("#trainer/")) {
			const id = hash.split("/")[1]
			this.showTrainerProfile(id)
			targetPage = "trainer-profile"
		} else if (hash.startsWith("#search?")) {
			const query = decodeURIComponent(hash.split("?q=")[1] || "")
			this.showSearchResults(query)
			targetPage = "search-results"
		} else {
			targetPage = hash.replace("#", "")
			const el = document.getElementById(`page-${targetPage}`)
			if (el) {
				el.style.display = "block"
			} else {
				document.getElementById("page-home").style.display = "block"
			}
		}

		document.body.dataset.page = targetPage

		const activeLink = document.querySelector(`nav.main-nav a[href="${hash}"]`)
		if (activeLink) activeLink.classList.add("active")

		window.scrollTo({ top: 0, behavior: "smooth" })
	},

	setupNavigation() {
		// Navigation events handled by ui-runtime.js
	},

	renderFeaturedPrograms() {
		const container = document.getElementById("featuredProgramsGrid")
		if (!container) return
		if (window.restoreSkeleton) window.restoreSkeleton(container)

		const featured = this.programs.filter(p => p.isFeatured).slice(0, 4)
		const list = featured.length ? featured : this.programs.slice(0, 4)
		container.innerHTML = list.length
			? list.map(p => this.createProgramCardHTML(p)).join("")
			: '<p class="qei-empty-state">لا توجد برامج مميزة متاحة حاليًا.</p>'
	},

	renderAllPrograms() {
		const container = document.getElementById("allProgramsGrid") || document.querySelector(".pl-grid")
		if (!container) return
		if (window.restoreSkeleton) window.restoreSkeleton(container)
		this.applyProgramFilters()
	},

	setupProgramFilters() {
		const grid = document.getElementById('allProgramsGrid')
		if (!grid || grid.dataset.filterWired === '1') return
		grid.dataset.filterWired = '1'
		this.programPage = 1
		this.programsPerPage = 12

		const search = document.getElementById('programSearchInput')
		if (search) {
			search.addEventListener('input', () => {
				this.programPage = 1
				this.applyProgramFilters()
				this.updateProgramsUrlFromFilters()
			})
		}

		const aside = document.querySelector('.pl-filters')
		if (aside) {
			aside.addEventListener('change', event => {
				if (!event.target.matches('input[type="checkbox"][data-filter-group]')) return
				this.programPage = 1
				this.applyProgramFilters()
				this.updateProgramsUrlFromFilters()
			})
		}

		const reset = document.getElementById('resetProgramFilters')
		if (reset) {
			reset.addEventListener('click', event => {
				event.preventDefault()
				document.querySelectorAll('.pl-filters input[type="checkbox"]').forEach(input => { input.checked = false })
				if (search) search.value = ''
				this.programPage = 1
				this.applyProgramFilters()
				window.history.replaceState({}, '', window.location.pathname)
			})
		}

		const toggle = document.getElementById('toggleProgramFilters')
		if (toggle && aside) {
			toggle.addEventListener('click', () => {
				const open = aside.classList.toggle('qei-filters-open')
				toggle.setAttribute('aria-expanded', open ? 'true' : 'false')
			})
		}

		this.syncProgramFiltersFromUrl()
	},

	syncProgramFiltersFromUrl() {
		if (!document.getElementById('allProgramsGrid')) return
		const params = new URLSearchParams(window.location.search)
		const search = document.getElementById('programSearchInput')
		if (search && params.has('q')) search.value = params.get('q') || ''

		const wanted = {
			category: new Set((params.get('category') || '').split(',').filter(Boolean)),
			level: new Set((params.get('level') || '').split(',').filter(Boolean)),
			mode: new Set((params.get('mode') || '').split(',').filter(Boolean)),
		}
		document.querySelectorAll('.pl-filters input[data-filter-group]').forEach(input => {
			const group = input.dataset.filterGroup
			input.checked = Boolean(wanted[group] && wanted[group].has(input.value))
		})
		this.programPage = 1
		if (this.programs.length) this.applyProgramFilters()
	},

	selectedProgramFilters(group) {
		return [...document.querySelectorAll(`.pl-filters input[data-filter-group="${group}"]:checked`)].map(input => input.value)
	},

	updateProgramsUrlFromFilters() {
		if (!document.getElementById('allProgramsGrid')) return
		const params = new URLSearchParams()
		const q = (document.getElementById('programSearchInput')?.value || '').trim()
		const categories = this.selectedProgramFilters('category')
		const levels = this.selectedProgramFilters('level')
		const modes = this.selectedProgramFilters('mode')
		if (q) params.set('q', q)
		if (categories.length) params.set('category', categories.join(','))
		if (levels.length) params.set('level', levels.join(','))
		if (modes.length) params.set('mode', modes.join(','))
		const query = params.toString()
		window.history.replaceState({}, '', window.location.pathname + (query ? '?' + query : ''))
	},

	applyProgramFilters() {
		const container = document.getElementById('allProgramsGrid') || document.querySelector('.pl-grid')
		if (!container) return
		const q = qeiNormalizeText(document.getElementById('programSearchInput')?.value || '')
		const categories = this.selectedProgramFilters('category')
		const levels = this.selectedProgramFilters('level')
		const modes = this.selectedProgramFilters('mode')

		const filtered = this.programs.filter(program => {
			const haystack = qeiNormalizeText([program.title, program.desc, program.category].join(' '))
			if (q && !haystack.includes(q)) return false
			if (categories.length && !categories.includes(program.categorySlug)) return false
			if (levels.length && !levels.includes(program.level)) return false
			if (modes.length && !modes.some(mode => program.modes.some(programMode => qeiNormalizeText(programMode).includes(qeiNormalizeText(mode))))) return false
			return true
		})

		const totalPages = Math.max(1, Math.ceil(filtered.length / (this.programsPerPage || 12)))
		this.programPage = Math.min(Math.max(1, this.programPage || 1), totalPages)
		const start = (this.programPage - 1) * (this.programsPerPage || 12)
		const visible = filtered.slice(start, start + (this.programsPerPage || 12))

		container.innerHTML = visible.length
			? visible.map(program => this.createPlCardHTML(program)).join('')
			: '<div class="qei-empty-state"><strong>لا توجد نتائج مطابقة</strong><span>جرّب تغيير المجال أو المستوى أو طريقة التنفيذ أو عبارة البحث.</span></div>'

		const count = document.getElementById('programCountBadge')
		if (count) count.textContent = `${filtered.length} برنامج تدريبي`
		this.renderProgramPagination(filtered.length)
	},

	renderProgramPagination(total) {
		const nav = document.querySelector('.pl-pagination')
		if (!nav) return
		const perPage = this.programsPerPage || 12
		const pages = Math.ceil(total / perPage)
		if (pages <= 1) { nav.innerHTML = ''; nav.hidden = true; return }
		nav.hidden = false
		const current = this.programPage || 1
		const buttons = []
		buttons.push(`<button type="button" data-page="${current - 1}" ${current === 1 ? 'disabled' : ''}>السابق</button>`)
		for (let page = 1; page <= pages; page++) {
			if (pages > 7 && page > 2 && page < pages - 1 && Math.abs(page - current) > 1) {
				if (buttons[buttons.length - 1] !== '<span class="pl-page-dots">…</span>') buttons.push('<span class="pl-page-dots">…</span>')
				continue
			}
			buttons.push(`<button type="button" data-page="${page}" class="${page === current ? 'active' : ''}" aria-current="${page === current ? 'page' : 'false'}">${page}</button>`)
		}
		buttons.push(`<button type="button" data-page="${current + 1}" ${current === pages ? 'disabled' : ''}>التالي</button>`)
		nav.innerHTML = buttons.join('')
		nav.querySelectorAll('button[data-page]:not([disabled])').forEach(button => {
			button.addEventListener('click', () => {
				this.programPage = Number(button.dataset.page)
				this.applyProgramFilters()
				document.querySelector('.pl-main')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
			})
		})
	},

	renderCalendarPrograms() {
		// Handled centrally in ui-runtime.js via wireCalendarListing to prevent duplicate rendering collision
		return;
	},

	renderProgramDetailsPage() {
		const page = document.getElementById("page-program-details");
		if (!page) return;

		const params = new URLSearchParams(window.location.search);
		const progKey = params.get("slug") || params.get("id") || params.get("program") || "1";

		const prog = this.programs.find(p => String(p.id) === String(progKey) || String(p.slug) === String(progKey));
		if (!prog) return;

		const titleEl = document.getElementById("pdProgramTitle");
		if (titleEl) titleEl.textContent = prog.title;

		const catEl = document.getElementById("pdCategoryTag");
		if (catEl) catEl.textContent = prog.category;

		const summaryEl = document.getElementById("pdProgramSummary");
		if (summaryEl) summaryEl.textContent = prog.desc || prog.summary || '';

		const aboutEl = document.getElementById("pdAboutText");
		if (aboutEl) aboutEl.textContent = prog.desc || prog.description || prog.summary || '';

		const durEl = document.getElementById("pdDurationTag");
		if (durEl) durEl.textContent = `المدة: ${prog.duration}`;

		const modeEl = document.getElementById("pdExecutionModeTag");
		if (modeEl) modeEl.textContent = `التنفيذ: ${prog.mode}`;

		const locEl = document.getElementById("pdLocationTag");
		if (locEl) locEl.textContent = `الموقع: ${prog.location || 'يحدد حسب الدفعة'}`;

		const scheduleId = prog.schedules && prog.schedules.length ? prog.schedules[0].id : "";
		document.querySelectorAll("#page-program-details .pd-actions button:first-child, #page-program-details .pd-enroll > button:first-of-type").forEach(button => {
			button.onclick = () => this.startRegistration(prog.id, scheduleId);
		});

		const imgEl = document.getElementById("pdHeroImage");
		const imgSource = prog.imageUrl || prog.image;
		if (imgEl && imgSource) {
			imgEl.src = qeiProgramImageUrl(imgSource);
			imgEl.onerror = () => {
				imgEl.onerror = null;
				imgEl.src = qeiUrl('assets/images/programs/course-placeholder.jpg');
			};
			imgEl.alt = prog.title;
		}

		page.classList.remove('qei-program-loading');
		page.classList.add('qei-data-ready');

		const batchesEl = document.getElementById("pdScheduleBatchesList");
		if (batchesEl) {
			if (prog.batches && prog.batches.length > 0) {
				batchesEl.innerHTML = prog.batches.map(b => `
					<div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px 18px; margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
						<div>
							<div style="font-weight: 700; color: #1e293b; font-size: 15px;">${qeiEscapeHTML(b.location || '')}</div>
							<div style="font-size: 13px; color: #64748b; margin-top: 4px;">التاريخ: <b>${qeiEscapeHTML(b.date || '')}</b>${b.time ? ` · ${qeiEscapeHTML(b.time)}` : ''}</div>
						</div>
						<div style="display: flex; align-items: center; gap: 10px;">
							<span style="background: #dcfce7; color: #15803d; font-size: 12px; font-weight: 700; padding: 5px 12px; border-radius: 99px;">${b.status}</span>
							<button onclick="QEI.startRegistration('${prog.id}', '${b.id}')" style="background: #0f766e; color: #fff; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: 600;">سجل في هذه الدفعة</button>
						</div>
					</div>
				`).join("");
			} else {
				batchesEl.innerHTML = `<p style="color: #64748b; padding: 10px 0;">لا توجد مواعيد دفعات متاحة حالياً لهذا البرنامج في قاعدة البيانات.</p>`;
			}
		}
	},

	renderScheduleSelection() {
		const container = document.getElementById("regScheduleGrid");
		if (!container) return;

		const params = new URLSearchParams(window.location.search);
		const programKey = params.get("program") || params.get("id") || params.get("slug") || "";
		const scheduleKey = params.get("schedule") || "";
		const activeProg = this.programs.find(p =>
			String(p.id) === String(programKey) || String(p.slug) === String(programKey)
		) || this.programs[0];

		if (activeProg && activeProg.batches && activeProg.batches.length > 0) {
			container.innerHTML = activeProg.batches.map((b, idx) => {
				const isSelected = scheduleKey ? String(b.id) === String(scheduleKey) : idx === 0;
				return `
				<label style="cursor: pointer;"><input type="radio" name="course-date" value="${qeiEscapeHTML(b.id)}" ${isSelected ? 'checked' : ''} /><i></i>
					<h3>${b.location || 'المركز'}</h3>
					<p>${b.date}</p>
					<p>${b.time || ''}</p>
					<span>${qeiEscapeHTML(b.execution_mode || 'يحدد عند الجدولة')}</span><b class="status-open">● ${qeiEscapeHTML(b.status)}</b>
				</label>`;
			}).join("");
		} else {
			container.innerHTML = `<p style="color: #64748b;">لا توجد مواعيد دفعات متاحة حالياً للتسجيل من قاعدة البيانات.</p>`;
		}
	},

	async renderCorporateSolutions() {
		const solutionIcon = (slug) => {
			const icons = {
				'training-needs': '<svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M4 3h16v2H4V3zm2 5h12v12H6V8zm2 2v8h8v-8H8zm1 1h6v2H9v-2zm0 3h4v2H9v-2z"/></svg>',
				'program-design': '<svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zm17.71-10.04a1.003 1.003 0 0 0 0-1.42l-2.5-2.5a1.003 1.003 0 0 0-1.42 0l-1.96 1.96 3.75 3.75 2.13-1.79z"/></svg>',
				'training-packages': '<svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M5 3h11a3 3 0 0 1 3 3v15H6a3 3 0 0 1-3-3V5a2 2 0 0 1 2-2zm1 2a1 1 0 0 0-1 1v9.17A3 3 0 0 1 6 15h11V6a1 1 0 0 0-1-1H6zm0 12a1 1 0 1 0 0 2h11v-2H6z"/></svg>',
				'consulting-solutions': '<svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5s-3 1.34-3 3 1.34 3 3 3zM8 11c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5 5 6.34 5 8s1.34 3 3 3zm8 2c-2 0-6 1-6 3v3h12v-3c0-2-4-3-6-3zM8 13c-2.33 0-7 1.17-7 3.5V19h7v-3c0-.85.33-1.58.92-2.2A7.7 7.7 0 0 0 8 13z"/></svg>',
				'measuring-impact': '<svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M4 19h16v2H2V3h2v16zm3-3 3.5-4 3 2.5L18 8l2 1.2-6 8.3-3-2.5L8.5 18 7 16z"/></svg>',
				'request-program': '<svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2a7 7 0 0 1 7 7c0 5.25-7 13-7 13S5 14.25 5 9a7 7 0 0 1 7-7zm-1 4v2H9v2h2v2h2v-2h2V8h-2V6h-2z"/></svg>'
			};
			return icons[slug] || '<svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M4 4h16v16H4z"/></svg>';
		};
		const renderDOM = (solutionsData) => {
			this.updateCatalogMetric('solutions', solutionsData.length)
			const homeGrid = document.getElementById("homeCorporateSolutionsGrid");
			if (homeGrid) {
				if (window.restoreSkeleton) window.restoreSkeleton(homeGrid);
				const homeSolutions = solutionsData.slice(0, 6);
				homeGrid.innerHTML = homeSolutions.map(s => `
					<article style="cursor: pointer;" onclick="window.location.href='${qeiUrl(s.link)}'">
						<img src="${qeiUrl(s.image || s.img)}" alt="${qeiEscapeHTML(s.title)}" loading="lazy" />
						<div class="home-solution-icon" aria-hidden="true">${solutionIcon(s.slug)}</div>
						<h3>${qeiEscapeHTML(s.title)}</h3>
						<p>${s.summary || s.desc}</p>
					</article>
				`).join("");
			}

			const solutionsGrid = document.getElementById("solutionsPageGrid");
			if (solutionsGrid) {
				if (window.restoreSkeleton) window.restoreSkeleton(solutionsGrid);
				solutionsGrid.innerHTML = solutionsData.map(s => {
					const target = qeiUrl(s.link || `solutions/solution-details.html?slug=${encodeURIComponent(s.slug || '')}`)
					const rawImage = s.image || s.img || 'assets/images/solutions/solutions-hero.jpeg'
					const image = String(rawImage).startsWith('http') ? rawImage : qeiUrl(rawImage)
					return `
						<a href="${qeiEscapeHTML(target)}" class="solution-card-link">
							<article>
								<img class="solution-card-image" src="${qeiEscapeHTML(image)}" alt="${qeiEscapeHTML(s.title)}" loading="lazy" decoding="async">
								<div class="icon-wrap" aria-hidden="true">${solutionIcon(s.slug)}</div>
								<h3>${qeiEscapeHTML(s.title)}</h3>
								<p>${qeiEscapeHTML(s.summary || s.desc || '')}</p>
								<div class="card-click-hint"><span>عرض التفاصيل ←</span></div>
							</article>
						</a>`
				}).join("");
			}
		};

		const api = await qeiWaitForAPI();
		if (api && typeof api.getCorporateSolutions === "function") {
			try {
				const isHomePage = !!document.getElementById("homeCorporateSolutionsGrid");
				const res = await api.getCorporateSolutions(isHomePage ? { limit: 6 } : {});
				if (res && res.status && Array.isArray(res.data) && res.data.length > 0) {
					renderDOM(res.data);
					return;
				}
			} catch (e) {
				console.warn('[QEI] Could not fetch corporate solutions from API; keeping the HTML fallback.', e);
			}
		}
		// Never leave a loader covering the static fallback when the API is unavailable.
		[document.getElementById("homeCorporateSolutionsGrid"), document.getElementById("solutionsPageGrid")].forEach(grid => {
			if (grid && window.restoreSkeleton) window.restoreSkeleton(grid);
		});
	},

	createPlCardHTML(p) {
		return this.createProgramCardHTML(p, 'listing')
	},

	createProgramCardHTML(p, variant = 'home') {
		const image = p.imageUrl || qeiUrl(p.image || 'assets/images/programs/course-placeholder.jpg')
		const detailsHref = qeiUrl(`programs/program-details.html?slug=${encodeURIComponent(p.slug || p.id)}`)
		const schedule = p.schedules && p.schedules.length ? p.schedules[0] : null
		const registerHref = qeiUrl(`registration/registration-personal.html?program=${encodeURIComponent(p.id)}${schedule ? '&schedule=' + encodeURIComponent(schedule.id) : ''}`)
		return `
			<article class="program-card qei-course-card ${variant === 'listing' ? 'qei-course-card--listing' : 'qei-course-card--home'}">
				<div class="card-img-wrap">
					<img src="${qeiEscapeHTML(image)}" alt="${qeiEscapeHTML(p.title)}" loading="lazy" decoding="async">
					<span class="card-category-tag">${qeiEscapeHTML(p.category)}</span>
				</div>
				<div class="card-body">
					<div class="qei-course-badges">
						<span class="badge badge-blue">${qeiEscapeHTML(p.level)}</span>
						<span class="badge badge-teal">${qeiEscapeHTML(p.mode)}</span>
					</div>
					<h3 class="card-title">${qeiEscapeHTML(p.title)}</h3>
					<div class="card-meta">
						<span class="card-meta-item">${qeiEscapeHTML(p.duration)}</span>
					</div>
					<div class="card-footer qei-course-actions">
						<a href="${qeiEscapeHTML(registerHref)}" class="btn btn-primary btn-sm btn-block">سجّل الآن</a>
					</div>
				</div>
			</article>
		`
	},

	renderTrainersGrid() {
		const container = document.getElementById("trainersGridContainer")
		if (container) container.dataset.ready = "true"
	},

	showTrainerProfile(id) {
		const page = document.getElementById("page-trainer-profile")
		if (page) page.style.display = "block"
	},

	showProgramDetails(id) {
		const page = document.getElementById("page-program-details")
		if (page) page.style.display = "block"
	},


	showClosedProgram(prg) {
		const page = document.getElementById("page-closed-program")
		if (page) page.style.display = "block"
	},

	showSearchResults(query) {
		const page = document.getElementById("page-search-results")
		if (!page) return
		const input = document.getElementById("searchQueryResult")
		if (input && query) input.value = query
		page.style.display = "block"
	},

	setupSearch() {
		const form = document.getElementById("quickSearchForm")
		if (!form || form.dataset.qeiWired === '1') return
		form.dataset.qeiWired = '1'
		form.addEventListener("submit", (event) => {
			event.preventDefault()
			const q = (document.getElementById("searchQueryInput")?.value || '').trim()
			const level = document.getElementById("homeSearchLevelSelect")?.value || ''
			const mode = document.getElementById("homeSearchModeSelect")?.value || ''
			const category = document.getElementById("homeSearchCategorySelect")?.value || ''
			const params = new URLSearchParams()
			if (q) params.set('q', q)
			if (level) params.set('level', level)
			if (mode) params.set('mode', mode)
			if (category) params.set('category', category)
			window.location.href = qeiUrl("programs/programs.html") + (params.toString() ? '?' + params.toString() : '')
		})
	},

	setupAccordions() {
		// Accordions handled centrally in ui-runtime.js via wireAccordions
	},

	toggleAccordion(btn) {
		const item = btn.closest(".accordion-item")
		if (item) item.classList.toggle("open")
	},

	startRegistration(programId, scheduleId) {
		const params = new URLSearchParams()
		if (programId && programId !== 'p1' && programId !== 'default') params.set('program', programId)
		if (scheduleId) params.set('schedule', scheduleId)
		window.location.href = qeiUrl("registration/registration-personal.html") + (params.toString() ? '?' + params.toString() : '')
	},

	setWizardStep(step) {
		this.currentWizardStep = step
		this.updateWizardUI()
	},

	updateWizardUI() {
		for (let i = 1; i <= 4; i++) {
			const stepItem = document.getElementById(`wizStepItem-${i}`)
			const stepContent = document.getElementById(`wizContentStep-${i}`)
			if (stepItem) {
				stepItem.classList.remove("active", "completed")
				if (i === this.currentWizardStep) stepItem.classList.add("active")
				else if (i < this.currentWizardStep) stepItem.classList.add("completed")
			}
			if (stepContent) {
				stepContent.style.display = i === this.currentWizardStep ? "block" : "none"
			}
		}
	},

	submitRegistration() {
		this.setWizardStep(4)
		this.showToast("تم إرسال طلب التسجيل بنجاح!")
	},

	setupModals() {
		// Modals handled centrally in ui-runtime.js via wireModals
	},

	openModal(modalId) {
		const modal = document.getElementById(modalId)
		if (modal) modal.classList.add("active")
	},

	closeModal(modalId) {
		const modal = document.getElementById(modalId)
		if (modal) modal.classList.remove("active")
	},

	setupPolicies() {
		const policyNavBtns = document.querySelectorAll(".policy-menu-btn")
		policyNavBtns.forEach((btn) => {
			btn.addEventListener("click", () => {
				policyNavBtns.forEach((b) => b.classList.remove("active"))
				btn.classList.add("active")

				const policyKey = btn.dataset.policy
				this.renderPolicyContent(policyKey)
			})
		})
	},

	renderPolicyContent(key) {
		const policy = this.policies[key] || this.policies.general_privacy
		const box = document.getElementById("policyContentBox")
		if (box) {
			box.innerHTML = `
        <h3>${policy.title}</h3>
        <small style="color: var(--slate-500); display: block; margin-bottom: 1.5rem;">تاريخ التحديث: ${policy.updated}</small>
        <div>${policy.content}</div>
      `
		}
	},

	showToast(message, type = "success") {
		if (window.QEIUI && window.QEIUI.toast) {
			window.QEIUI.toast(message, type)
			return
		}
		let container = document.getElementById("toastContainer")
		if (!container) {
			container = document.createElement("div")
			container.id = "toastContainer"
			container.className = "toast-container"
			document.body.appendChild(container)
		}
		const toast = document.createElement("div")
		toast.className = `toast toast-${type}`
		toast.innerHTML = `<span>✓</span> <span>${message}</span>`
		container.appendChild(toast)
		setTimeout(() => { toast.remove() }, 4000)
	},
}

/* ==========================================================================
   Multipage support — every screen is its own .html file, so hash routing is
   replaced by plain navigation while all interactive widgets keep working.
   ========================================================================== */
QEI.isMultipage = function () {
	return document.body.dataset.multipage === "1"
}

QEI.currentFile = function () {
	const f = window.location.pathname.split("/").pop()
	return f === "" ? "index.html" : f
}

QEI.setupMultipage = function () {
	const here = QEI.currentFile()
	document.querySelectorAll(".main-nav a").forEach((a) => {
		const href = (a.getAttribute("href") || "").split("/").pop()
		a.classList.toggle("active", href === here)
	})
}

QEI.startRegistration = function (programId, scheduleId) {
	const params = new URLSearchParams()
	if (programId && programId !== 'p1' && programId !== 'default') params.set('program', programId)
	if (scheduleId) params.set('schedule', scheduleId)
	window.location.href = qeiUrl("registration/registration-personal.html") + (params.toString() ? '?' + params.toString() : '')
}

window.QEI = QEI;

document.addEventListener("DOMContentLoaded", () => {
	QEI.init()
	if (QEI.isMultipage()) QEI.setupMultipage()
})
