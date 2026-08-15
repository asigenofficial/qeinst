/* ==========================================================================
   QEI UI Runtime
   ==========================================================================
   This file makes every interactive control on the site actually work.

   Why a separate file: app.js holds the original page data and legacy SPA
   logic. Everything added here is additive and uses event delegation, so it
   works on all 42 pages without touching their markup, and nothing breaks if
   a widget is absent from a given page.

   Contents
	 1.  Helpers (root-relative navigation, storage, toast, text normalising)
	 2.  Form validation (Arabic messages, Saudi ID / phone / email rules)
	 3.  Newsletter subscribe
	 4.  Registration flow (page-to-page wizard + persistence + review)
	 5.  Filter chips, reset, pagination, load-more
	 6.  Gallery lightbox + view toggle
	 7.  Share + social links
	 8.  Language toggle (interface chrome)
	 9.  Modals (Esc, focus trap, aria) + accordions (aria) + mobile menu
   ========================================================================== */
; (function () {
	"use strict"

	/* ---------------------------------------------------------------- 1. helpers */

	// app.js already computes the site root from its own <script> src. Recompute
	// here the same way so this file is independent and order does not matter.
	const ROOT = (function () {
		const self =
			document.currentScript ||
			Array.prototype.find.call(document.getElementsByTagName("script"), (s) => /ui-runtime\.js(\?|$)/.test(s.src))
		return self ? self.src.replace(/assets\/js\/ui-runtime\.js.*$/, "") : ""
	})()

	const url = (p) => {
		const target = String(p).replace(/^\/+/, "");
		if (ROOT && ROOT !== "") {
			return ROOT + target;
		}
		if (/registration[\\\/]/i.test(location.pathname) && target.startsWith("registration/")) {
			return target.replace(/^registration\//i, "");
		}
		if (/programs[\\\/]/i.test(location.pathname) && target.startsWith("programs/")) {
			return target.replace(/^programs\//i, "");
		}
		return target;
	}
	const $ = (sel, ctx) => (ctx || document).querySelector(sel)
	const $$ = (sel, ctx) => Array.from((ctx || document).querySelectorAll(sel))

	// Strip emoji / symbols / diacritics so chip text can be compared with card text.
	const norm = (s) =>
		String(s || "")
			.replace(/[\u0600-\u0605\u0610-\u061A\u064B-\u065F\u0670]/g, "")
			.replace(/[^\p{L}\p{N}\s]/gu, " ")
			.replace(/\s+/g, " ")
			.trim()

	const store = {
		key: "qei.registration",
		read() {
			try {
				return JSON.parse(localStorage.getItem(this.key) || "{}")
			} catch (e) {
				return {}
			}
		},
		write(obj) {
			try {
				localStorage.setItem(this.key, JSON.stringify(Object.assign(this.read(), obj)))
			} catch (e) {
				/* private mode: registration still works, it just will not be remembered */
			}
		},
	}

	function toast(msg, type) {
		if (window.QEI && typeof QEI.showToast === "function" && QEI.showToast !== toast) {
			return QEI.showToast(msg, type || "success")
		}
		let c = $("#toastContainer")
		if (!c) {
			c = document.createElement("div")
			c.id = "toastContainer"
			c.className = "toast-container"
			document.body.appendChild(c)
		}
		const t = document.createElement("div")
		t.className = "toast toast-" + (type || "success")
		t.textContent = msg
		c.appendChild(t)
		setTimeout(() => t.remove(), 3600)
	}

	// Public, documented configuration. Fill these in when the real accounts exist.
	const config = {
		social: { x: "", linkedin: "", youtube: "", instagram: "" },
	}

	/* ------------------------------------------------------- 2. form validation */

	const normDigits = (s) => String(s || "")
		.replace(/[٠۰]/g, '0')
		.replace(/[١۱]/g, '1')
		.replace(/[٢۲]/g, '2')
		.replace(/[٣۳]/g, '3')
		.replace(/[٤۴]/g, '4')
		.replace(/[٥۵]/g, '5')
		.replace(/[٦۶]/g, '6')
		.replace(/[٧۷]/g, '7')
		.replace(/[٨۸]/g, '8')
		.replace(/[٩۹]/g, '9');

	const RULES = {
		email: {
			test: (v) => /^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/.test(v.trim()),
			msg: "صيغة البريد الإلكتروني غير صحيحة",
		},
		tel: {
			test: (v) => /^\+?\d{8,15}$/.test(normDigits(v).replace(/[\s-]/g, "")),
			msg: "يرجى إدخال رقم جوال صحيح",
		},
		nationalId: {
			test: (v) => /^\d{10}$/.test(normDigits(v).replace(/\s/g, "")),
			msg: "رقم الهوية يجب أن يتكون من 10 أرقام",
		},
		password: { test: (v) => v.length >= 6, msg: "كلمة المرور يجب أن تكون 6 أحرف على الأقل" },
		fullName: { test: (v) => v.trim().length >= 2, msg: "يرجى كتابة الاسم بشكل صحيح" },
	}

	// Infer which rule applies from the field itself (no markup changes needed).
	function ruleFor(field) {
		if (field.dataset.rule) return RULES[field.dataset.rule]
		const keyText = (field.id || "") + " " + (field.name || "") + " " + (field.placeholder || "") + " " + (field.getAttribute("aria-label") || "");
		if (field.type === "email" || /email|بريد/i.test(keyText)) return RULES.email
		if (field.type === "tel" || /phone|tel|جوال|هاتف/i.test(keyText)) return RULES.tel
		if (field.type === "password" || /password|كلمة المرور/i.test(keyText)) return RULES.password
		if (/nationalId|national_id|هوية|10 أرقام|\bid\b/i.test(keyText)) return RULES.nationalId
		if (/fullName|full_name|الاسم/i.test(keyText)) return RULES.fullName
		return null
	}

	function fieldError(field, message) {
		clearError(field)
		field.classList.add("is-invalid")
		field.setAttribute("aria-invalid", "true")
		const e = document.createElement("span")
		e.className = "field-error"
		e.textContent = message
		const host = field.closest("label") || field.parentElement
		host.appendChild(e)
	}

	function clearError(field) {
		field.classList.remove("is-invalid")
		field.removeAttribute("aria-invalid")
		const host = field.closest("label") || field.parentElement
		const old = host && host.querySelector(":scope > .field-error")
		if (old) old.remove()
	}

	function fields(form) {
		return $$("input, select, textarea", form).filter(
			(f) => !["hidden", "submit", "button", "reset"].includes(f.type) && !f.disabled,
		)
	}

	function validate(form) {
		let firstBad = null
		for (const f of fields(form)) {
			clearError(f)
			const v = (f.value || "").trim()
			const required = f.required || f.getAttribute("aria-required") === "true"
			if (required && !v) {
				fieldError(f, f.tagName === "SELECT" ? "يجب اختيار قيمة من القائمة" : "هذا الحقل مطلوب")
				firstBad = firstBad || f
				continue
			}
			if (!v) continue
			const rule = ruleFor(f)
			if (rule && !rule.test(v)) {
				fieldError(f, rule.msg)
				firstBad = firstBad || f
			}
			if (f.type === "checkbox" && required && !f.checked) {
				fieldError(f, "يجب الموافقة للمتابعة")
				firstBad = firstBad || f
			}
		}
		if (firstBad) {
			firstBad.focus()
			firstBad.scrollIntoView({ block: "center", behavior: "smooth" })
			toast("يرجى تصحيح الحقول المطلوبة", "error")
			return false
		}
		return true
	}

	function values(form) {
		const out = {}
		fields(form).forEach((f, i) => {
			const k = f.id || f.name || (f.getAttribute("aria-label") || f.placeholder || "field") + "_" + i
			out[k] = f.type === "checkbox" ? f.checked : f.value
		})
		return out
	}

	// Live: clear the error as soon as the user starts fixing the field.
	document.addEventListener("input", (e) => {
		if (e.target.matches("input, select, textarea") && e.target.classList.contains("is-invalid")) clearError(e.target)
	})

	/* ------------------------------------------------------------ 3. newsletter */

	function wireNewsletter() {
		for (const btn of $$("button")) {
			if (!/اشترك/.test(btn.textContent) || btn.dataset.qeiWired) continue
			const scope = btn.closest("section, form, div") || document
			const input =
				btn.previousElementSibling && btn.previousElementSibling.matches("input")
					? btn.previousElementSibling
					: $("input", scope)
			if (!input) continue
			btn.dataset.qeiWired = "1"
			btn.type = btn.type || "button"
			const submit = () => {
				const v = input.value.trim()
				clearError(input)
				if (!v) return fieldError(input, "أدخل بريدك الإلكتروني")
				if (!RULES.email.test(v)) return fieldError(input, RULES.email.msg)
				const list = JSON.parse(localStorage.getItem("qei.newsletter") || "[]")
				if (!list.includes(v)) list.push(v)
				try {
					localStorage.setItem("qei.newsletter", JSON.stringify(list))
				} catch (e) { }
				input.value = ""
				toast("تم تسجيل بريدك في النشرة البريدية")
			}
			btn.addEventListener("click", (e) => {
				e.preventDefault()
				submit()
			})
			input.addEventListener("keydown", (e) => {
				if (e.key === "Enter") {
					e.preventDefault()
					submit()
				}
			})
		}
	}

	/* --------------------------------------------------- 4. registration flow */

	// The original markup navigated with window.location.hash, which does nothing
	// in this multipage build (the hash router is intentionally disabled). These
	// are the real destinations.
	const REG = {
		personal: "registration/registration-personal.html",
		work: "registration/registration-work.html",
		schedule: "registration/registration-schedule.html",
		review: "registration/registration-review.html",
		success: "registration/registration-success.html",
		requestSuccess: "registration/request-success.html",
		programs: "programs/programs.html",
	}

	const REVIEW_LABELS = {
		"رقم الهوية": "nationalId",
		"الاسم الكامل": "fullName",
		"الاسم الرباعي": "fullName",
		"تاريخ الميلاد": "birthDate",
		"البريد الإلكتروني": "email",
		"رقم الجوال": "phone",
		"الجنسية": "nationality",
		"الحالة الاجتماعية": "maritalStatus",
		"أعلى مؤهل": "education",
		"المؤهل العلمي": "education",
		"الكلية أو الجهة التعليمية": "university",
		"اسم الجامعة": "university",
		"التخصص": "specialization",
		"المسمى الوظيفي": "jobTitle",
		"القسم / الإدارة": "department",
		"الشركة / الجهة": "employer",
		"مسمى العمل الحالي": "currentJob",
		"تاريخ البداية": "selectedDate",
		"البرنامج": "selectedProgram",
	}

	// Guess a stable key for a registration field from its id, name, or label/placeholder.
	function regKey(field) {
		if (field.id) return field.id
		if (field.name) return field.name
		const labelEl = field.closest("label")
		let labelText = ""
		if (labelEl) {
			const clone = labelEl.cloneNode(true)
			Array.from(clone.querySelectorAll("input, select, textarea, small, span, div")).forEach((el) => el.remove())
			labelText = clone.textContent
		}
		const label = (labelText + " " + (field.placeholder || "")).trim()
		if (/هوية|10 أرقام/.test(label)) return "nationalId"
		if (/الاسم الكامل|كما هو مسجل|الاسم الرباعي/.test(label)) return "fullName"
		if (/بريد/.test(label)) return "email"
		if (/جوال|هاتف/.test(label)) return "phone"
		if (/نوع الجهة|القطاع|entity_type|entityType/.test(label)) return "entity_type"
		if (/جهة العمل|الشركة|اسم الشركة|المنشأة|company_name|companyName/.test(label)) return "company_name"
		if (/المسمى الوظيفي|job_title|jobTitle/.test(label)) return "job_title"
		if (/المؤهل|التعليم/.test(label)) return "education"
		if (/تاريخ الميلاد|العمر/.test(label)) return "birthDate"
		if (/الجنس/.test(label)) return "gender"
		if (/المدينة/.test(label)) return "city"
		return null
	}

	function saveRegForm(form) {
		const data = {}
		fields(form).forEach((f) => {
			const k = regKey(f)
			if (k) {
				let val = f.type === "checkbox" ? f.checked : f.value;
				if (typeof val === "string" && (k === "nationalId" || k === "phone")) {
					val = normDigits(val);
				}
				data[k] = val;
			}
		})
		store.write(data)
	}

	function restoreRegForm(form) {
		const data = store.read()
		fields(form).forEach((f) => {
			const k = regKey(f)
			if (k && data[k] != null && data[k] !== "") {
				if (k === "nationalId" && !/^\d+$/.test(String(data[k]).trim())) {
					return
				}
				if (f.type === "checkbox") f.checked = !!data[k]
				else if (f.tagName === "SELECT") {
					const opt = Array.from(f.options).find((o) => o.value === data[k] || o.textContent.trim() === data[k])
					if (opt) f.value = opt.value
				} else f.value = data[k]
			}
		})
	}

	// Fill the review page from what the user actually typed.
	function populateReview() {
		if (!/registration-review/.test(location.pathname)) return;
		const data = store.read() || {};
		if (!Object.keys(data).length) return;

		const MAPPING = {
			"الاسم الكامل": data.fullName || data.full_name || data.name,
			"الاسم الرباعي": data.fullName || data.full_name || data.name,
			"تاريخ الميلاد": data.birthDate || data.birth_date,
			"رقم الهوية": data.nationalId || data.national_id,
			"رقم الجوال": data.phone,
			"الجنس": data.gender,
			"الحالة الاجتماعية": data.maritalStatus || data.marital_status,
			"الجنسية": data.nationality || 'سعودي',
			"المدينة": data.city || 'الرياض',
			"البريد الإلكتروني": data.email,
			"أعلى مؤهل": data.education || data.qualification,
			"المؤهل العلمي": data.education || data.qualification,
			"الكلية أو الجهة التعليمية": data.university,
			"اسم الجامعة": data.university,
			"التخصص": data.specialization,
			"نوع الجهة / القطاع": data.entity_type || data.sector,
			"الشركة / الجهة": data.company_name || data.companyName || data.employer,
			"جهة العمل / اسم الشركة": data.company_name || data.companyName || data.employer,
			"المسمى الوظيفي": data.jobTitle || data.job_title || data.currentJob,
			"القسم / الإدارة": data.department,
			"مسمى العمل الحالي": data.currentJob || data.jobTitle,
			"مستوى اللغة الإنجليزية": data.englishLevel || data.english_level,
			"البرنامج": data.program_name || data.programName || data.selectedProgram || data.course_name,
			"المكان": data.selectedLocation || data.location || 'معهد خبراء الجودة للتدريب'
		};

		$$(".rgr-main dl, main dl").forEach(dl => {
			const dts = $$("dt", dl);
			dts.forEach(dt => {
				const label = dt.textContent.trim();
				const dd = dt.nextElementSibling;
				if (!dd || dd.tagName !== "DD") return;

				if (label === "سنة التخرج") {
					dt.textContent = "نوع الجهة";
					dd.textContent = data.entity_type || '—';
					return;
				}
				if (label === "رقم السجل التجاري") {
					dt.textContent = "القسم / الإدارة";
					dd.textContent = data.department || '—';
					return;
				}
				if (label === "سنوات الخبرة") {
					dt.textContent = "مستوى الإنجليزية";
					dd.textContent = data.englishLevel || 'متوسط';
					return;
				}

				if (label in MAPPING && MAPPING[label] !== undefined && MAPPING[label] !== null && MAPPING[label] !== "") {
					const span = $("span", dd);
					if (span) {
						span.textContent = MAPPING[label];
					} else {
						dd.textContent = MAPPING[label];
					}
				}
			});
		});
	}

	const api = {
		go(path) {
			const destUrl = url(path);
			location.href = destUrl;
		},
		regNext(target) {
			const form = $("main form, form.reg-form, .reg-main form");
			if (form && !form.closest(".modal-overlay, .modal-box, #modal-login, #modal-registration")) {
				if (typeof form.checkValidity === "function" && !form.checkValidity()) {
					if (typeof form.reportValidity === "function") {
						form.reportValidity();
					}
					const isEn = (localStorage.getItem("qei.lang") || "ar") === "en";
					toast(isEn ? "Please fill out all required fields before proceeding" : "يرجى تعبئة جميع الحقول المطلوبة قبل المتابعة");
					return false;
				}

				// A registration opened directly from the header starts without a course.
				// Require an explicit course choice before leaving the personal-data step.
				if (target === "work" && /registration-personal/i.test(location.pathname)) {
					const current = store.read() || {};
					const picker = document.getElementById("qeiProgramQuickSelect");
					const chosenProgram = (picker && picker.value) || current.program_id || current.programId;
					if (!chosenProgram) {
						const isEn = (localStorage.getItem("qei.lang") || "ar") === "en";
						if (picker) {
							picker.classList.add("qei-field-error");
							picker.setAttribute("aria-invalid", "true");
							picker.focus({ preventScroll: true });
							picker.scrollIntoView({ behavior: "smooth", block: "center" });
						}
						toast(isEn ? "Please choose a training program before continuing" : "يرجى اختيار البرنامج التدريبي قبل المتابعة", "error");
						return false;
					}
				}
				saveRegForm(form);
			}

			// Capture schedule choice if on schedule page
			const selectedRadio = $("input[name='course-date']:checked, .rgs-date-card.active input, .rgs-date-card.selected input");
			if (selectedRadio) {
				const card = selectedRadio.closest(".rgs-date-card, label");
				const schedId = selectedRadio.value;
				const dateP = card ? $("p", card) : null;
				const locH3 = card ? $("h3", card) : null;
				store.write({
					schedule_id: schedId,
					scheduleId: schedId,
					selectedDate: null,
					selectedLocation: locH3 ? locH3.textContent.trim() : null
				});
			}

			if (target === 'requestSuccess') {
				const data = store.read() || {};
				if (!data.applicant_name && data.fullName) data.applicant_name = data.fullName;
				if (!data.company_name && data.employer) data.company_name = data.employer;
				if (window.QEIAPI && typeof window.QEIAPI.submitCorporateRequest === "function") {
					window.QEIAPI.submitCorporateRequest(data).then(res => {
						console.log("Corporate request saved to Laravel API:", res);
					}).catch(err => console.warn("Corporate request API error:", err));
				}
			}
			const destination = REG[target] || target;
			const destUrl = url(destination);
			const current = store.read() || {};
			const q = new URLSearchParams(location.search);
			const chosenProgramId = current.program_id || current.programId;
			const chosenProgramName = current.program_name || current.programName || current.selectedProgram;
			if (chosenProgramId) q.set("program", chosenProgramId);
			if (chosenProgramName) q.set("program_name", chosenProgramName);
			["schedule", "schedule_id", "scheduleId", "date", "start_date", "end_date"].forEach(key => q.delete(key));
			location.href = destUrl + (q.toString() ? "?" + q.toString() : "");
			return true;
		},
		regBack(target) {
			const form = $("main form, form.reg-form, .reg-main form");
			if (form && !form.closest(".modal-overlay, .modal-box, #modal-login, #modal-registration")) {
				saveRegForm(form);
			}
			const destination = REG[target] || target;
			const destUrl = url(destination);
			const current = store.read() || {};
			const q = new URLSearchParams(location.search);
			const chosenProgramId = current.program_id || current.programId;
			const chosenProgramName = current.program_name || current.programName || current.selectedProgram;
			if (chosenProgramId) q.set("program", chosenProgramId);
			if (chosenProgramName) q.set("program_name", chosenProgramName);
			["schedule", "schedule_id", "scheduleId", "date", "start_date", "end_date"].forEach(key => q.delete(key));
			location.href = destUrl + (q.toString() ? "?" + q.toString() : "");
		},
		regSaveExit() {
			const form = $("main form, form.reg-form, .reg-main form");
			if (form && !form.closest(".modal-overlay, .modal-box, #modal-login, #modal-registration")) {
				saveRegForm(form);
			}
			toast("تم حفظ بياناتك، يمكنك المتابعة لاحقًا");
			setTimeout(() => api.go("index.html"), 900);
		},
			regSubmit() {
				const checkboxes = $$(".rgr-consent input[type='checkbox']");
				const allConsentsChecked = checkboxes.length > 0 && checkboxes.every(cb => cb.checked);
				if (!allConsentsChecked) {
					const consentSection = $(".rgr-consent");
					if (consentSection) consentSection.setAttribute("aria-invalid", "true");
					toast("يرجى الموافقة على جميع التعهدات قبل إرسال الطلب", "error");
					return false;
				}

				const submitBtn = $(".rgr-actions button.submit, button.submit, .submit");
			if (submitBtn) {
				submitBtn.disabled = true;
				submitBtn.textContent = "جارٍ إرسال الطلب... ⏳";
			}

			const data = store.read() || {};
			let progName = data.program_name || data.programName || data.selectedProgram || data.course_name;
			if (!progName || progName.includes("المعتمد") || progName.includes("لم يتم")) {
				const summaryTitle = $(".reg-summary h3") || $(".selected-program-title");
				if (summaryTitle && summaryTitle.textContent && !summaryTitle.textContent.includes("لم يتم") && !summaryTitle.textContent.includes("المعتمد")) {
					progName = summaryTitle.textContent.trim();
				}
			}
			if (!progName) {
				try {
					progName = sessionStorage.getItem("qei_selected_program_name") || sessionStorage.getItem("qei_selected_program_title");
				} catch (e) { }
			}
			if (progName) {
				data.program_name = progName;
				data.programName = progName;
				data.selectedProgram = progName;
			}

			if (!data.company_name && data.employer) data.company_name = data.employer;
			if (!data.companyName && data.company_name) data.companyName = data.company_name;
			if (!data.entity_type && data.sector) data.entity_type = data.sector;
			if (!data.entityType && data.entity_type) data.entityType = data.entity_type;
			if (!data.job_title && data.jobTitle) data.job_title = data.jobTitle;
			if (!data.job_title && data.currentJob) data.job_title = data.currentJob;
			if (!data.jobTitle && data.job_title) data.jobTitle = data.job_title;

			const params = new URLSearchParams(location.search);
			if (!data.program_id && !data.programId && params.get("program")) {
				data.program_id = params.get("program");
				data.programId = params.get("program");
			}
			if (!data.schedule_id && !data.scheduleId && params.get("schedule")) {
				data.schedule_id = params.get("schedule");
				data.scheduleId = params.get("schedule");
			}

			store.write({ submittedAt: new Date().toISOString() });

							const restoreSubmitButton = () => {
					if (submitBtn) {
						submitBtn.disabled = false;
						submitBtn.textContent = "✈ إرسال طلب التسجيل";
					}
				};
				const showSubmitError = () => {
					restoreSubmitButton();
					toast("تعذر حفظ طلب التسجيل في الخادم. يرجى المحاولة مرة أخرى بعد التحقق من الاتصال.", "error");
				};
				const doRedirect = (regNum) => {
					if (!regNum) {
						showSubmitError();
						return false;
					}
					store.write({ registration_number: regNum, program_name: progName });
					try {
						sessionStorage.setItem("qei_selected_program_name", progName || '');
					} catch (e) { }
					const destUrl = url(REG.success) + '?registration_number=' + encodeURIComponent(regNum);
					location.href = destUrl;
					return true;
				};

				if (window.QEIAPI && typeof window.QEIAPI.submitRegistration === "function") {
					window.QEIAPI.submitRegistration(data).then(res => {
						console.log('Successfully saved to Laravel backend:', res);
						const regNum = (res && (res.registration_number || (res.data && res.data.registration_number))) || null;
						if (!res || res.status !== true || !regNum) throw new Error("Invalid registration response");
						if (res.summary_token) store.write({ summary_token: res.summary_token });
						doRedirect(regNum);
					}).catch(err => {
						console.warn('Laravel API error, registration was not redirected:', err);
						showSubmitError();
					});
				} else {
					showSubmitError();
				}

		},
		downloadRegistrationSummary() {
			const saved = store.read() || {}
			const numEl = document.getElementById('rss-reg-number')
			const regNum = saved.registration_number || (numEl ? numEl.textContent.trim() : null)
			const summaryToken = saved.summary_token || ''
			if (!regNum || !summaryToken) {
				toast("لا يتوفر رابط آمن لملخص هذا الطلب. يرجى التواصل مع المعهد.", "error")
				return
			}

			toast("جاري تحميل ملخص التسجيل...")

			const apiBase = (typeof QEI_API_BASE !== 'undefined') ? QEI_API_BASE : ((typeof window !== 'undefined' && window.location && window.location.origin) ? (window.location.origin + '/api/v1') : '/api/v1');
			const downloadUrl = apiBase + '/registrations/' + encodeURIComponent(regNum) + '/summary?token=' + encodeURIComponent(summaryToken)
			const a = document.createElement("a")
			a.href = downloadUrl

			a.target = "_blank"
			a.download = "QEI-Summary-" + regNum + ".html"
			document.body.appendChild(a)
			a.click()
			document.body.removeChild(a)
		},
		config,
		validateForm: validate,
		toast,
	}

	/* ------------------------------- 5. filter chips, reset, pagination, more */

	const CARD_SEL = "article, .program-card, .card, .trainer-card, .gallery-item, .news-card, li.card"

	function gridFor(group) {
		// The grid is usually a sibling/uncle of the chip row; search outward.
		let node = group
		for (let i = 0; i < 4 && node; i++) {
			const scope = node.parentElement || node
			const candidates = $$("[class*='grid'], [class*='list'], [class*='strip'], [class*='cards']", scope).filter(
				(g) => $$(CARD_SEL, g).length >= 2,
			)
			if (candidates.length) return candidates[0]
			node = node.parentElement
		}
		return null
	}

	function wireFilterGroups() {
		// A filter group = 2+ sibling buttons with no handler of their own, where one
		// of them is "الكل" or the container looks like a filter/category row.
		const groups = new Set()
		for (const btn of $$("button")) {
			const p = btn.parentElement
			if (!p) continue
			const sibs = $$(":scope > button", p)
			if (sibs.length < 2) continue
			const cls = String(p.className || "")
			const looksLikeFilter =
				/filter|cat|chip|tab|tag/i.test(cls) || sibs.some((b) => norm(b.textContent) === "الكل")
			if (looksLikeFilter && !sibs.some((b) => b.hasAttribute("onclick"))) groups.add(p)
		}

		for (const group of groups) {
			const grid = gridFor(group)
			if (!grid) continue
			const cards = $$(CARD_SEL, grid)
			if (cards.length < 2) continue
			group.setAttribute("role", "group")
			for (const btn of $$(":scope > button", group)) {
				if (btn.dataset.qeiWired) continue
				btn.dataset.qeiWired = "1"
				btn.type = btn.type || "button"
				btn.setAttribute("aria-pressed", btn.classList.contains("active") ? "true" : "false")
				btn.addEventListener("click", (e) => {
					e.preventDefault()
					const term = norm(btn.textContent)
					for (const b of $$(":scope > button", group)) {
						const on = b === btn
						b.classList.toggle("active", on)
						b.setAttribute("aria-pressed", on ? "true" : "false")
					}
					let shown = 0
					for (const card of cards) {
						const show = !term || term === "الكل" || norm(card.textContent).includes(term)
						card.hidden = !show
						card.style.display = show ? "" : "none"
						if (show) shown++
					}
					const badge = $("#programCountBadge")
					if (badge) badge.textContent = String(shown)
					const empty = ensureEmptyState(grid)
					empty.hidden = shown > 0
					resetPagination(grid)
				})
			}
		}
	}

	function ensureEmptyState(grid) {
		let el = grid.parentElement.querySelector(":scope > .qei-empty")
		if (!el) {
			el = document.createElement("p")
			el.className = "qei-empty"
			el.setAttribute("role", "status")
			el.textContent = "لا توجد نتائج مطابقة. جرّب فلترًا آخر."
			el.hidden = true
			grid.parentElement.insertBefore(el, grid.nextSibling)
		}

		const pagination = grid.parentElement.querySelector(".pl-pagination");
		if (pagination) {
			if (!el.hidden) {
				pagination.style.setProperty("display", "none", "important");
			} else {
				pagination.style.removeProperty("display");
			}
		}

		return el
	}

	function wireResetFilters() {
		for (const btn of $$("button, a")) {
			if (!/إعادة (تعيين|ضبط)/.test(btn.textContent) || btn.dataset.qeiWired) continue
			btn.dataset.qeiWired = "1"
			btn.addEventListener("click", (e) => {
				e.preventDefault()
				const scope = btn.closest("aside, form, section") || document
				$$("input", scope).forEach((i) => {
					if (i.type === "checkbox" || i.type === "radio") i.checked = false
					else i.value = ""
				})
				$$("select", scope).forEach((s) => (s.selectedIndex = 0))
				$$("button.active", document).forEach((b) => {
					if (norm(b.textContent) !== "الكل") b.classList.remove("active")
				})
				$$(CARD_SEL).forEach((c) => {
					c.hidden = false
					if (c.style.display === "none") c.style.display = ""
				})
				$$(".qei-empty").forEach((e2) => (e2.hidden = true))
				toast("تم إعادة تعيين الفلاتر")
			})
		}
	}

	const PAGE_SIZE = 9
	function resetPagination(grid) {
		if (grid && grid.dataset.qeiPaged) applyPage(grid, 1)
	}
	function applyPage(grid, page) {
		const cards = $$(CARD_SEL, grid).filter((c) => !c.hidden)
		const pages = Math.max(1, Math.ceil(cards.length / PAGE_SIZE))
		const p = Math.min(Math.max(1, page), pages)
		grid.dataset.qeiPage = String(p)
		cards.forEach((c, i) => {
			c.style.display = i >= (p - 1) * PAGE_SIZE && i < p * PAGE_SIZE ? "" : "none"
		})
		const nav = grid.qeiNav
		if (nav) {
			$$("button", nav).forEach((b) => {
				const n = parseInt(b.textContent.trim(), 10)
				if (!isNaN(n)) {
					b.classList.toggle("active", n === p)
					b.setAttribute("aria-current", n === p ? "page" : "false")
					b.hidden = n > pages
				}
			})
		}
	}

	function wirePagination() {
		for (const nav of $$("[class*='pagination'], [class*='pager']")) {
			const grid = gridFor(nav)
			if (!grid || nav.dataset.qeiWired) continue
			nav.dataset.qeiWired = "1"
			grid.dataset.qeiPaged = "1"
			grid.qeiNav = nav
			nav.setAttribute("aria-label", "تصفّح النتائج")
			for (const btn of $$("button, a", nav)) {
				btn.addEventListener("click", (e) => {
					e.preventDefault()
					const cur = parseInt(grid.dataset.qeiPage || "1", 10)
					const label = btn.textContent.trim()
					const n = parseInt(label, 10)
					if (!isNaN(n)) applyPage(grid, n)
					else if (/‹|»|التالي|next/i.test(label)) applyPage(grid, cur + 1)
					else if (/›|«|السابق|prev/i.test(label)) applyPage(grid, cur - 1)
					grid.scrollIntoView({ block: "start", behavior: "smooth" })
				})
			}
			applyPage(grid, 1)
		}
	}

	function wireLoadMore() {
		for (const btn of $$("button, a")) {
			if (!/تحميل المزيد|المزيد/.test(btn.textContent) || btn.dataset.qeiWired) continue
			const grid = gridFor(btn)
			if (!grid) continue
			btn.dataset.qeiWired = "1"
			btn.addEventListener("click", (e) => {
				e.preventDefault()
				const hidden = $$(CARD_SEL, grid).filter((c) => c.style.display === "none" || c.hidden)
				if (!hidden.length) {
					btn.disabled = true
					btn.textContent = "تم عرض كل النتائج"
					return
				}
				hidden.slice(0, PAGE_SIZE).forEach((c) => {
					c.hidden = false
					c.style.display = ""
				})
				toast("تم تحميل المزيد من النتائج")
			})
		}
	}

	/* ---------------------------------------- 6. gallery lightbox + view toggle */

	let lb
	function lightbox() {
		if (lb) return lb
		lb = document.createElement("div")
		lb.className = "qei-lightbox"
		lb.setAttribute("role", "dialog")
		lb.setAttribute("aria-modal", "true")
		lb.setAttribute("aria-label", "معرض الصور")
		lb.innerHTML =
			'<button class="qei-lb-close" aria-label="إغلاق">✕</button>' +
			'<button class="qei-lb-prev" aria-label="السابق">‹</button>' +
			'<img alt="" />' +
			'<button class="qei-lb-next" aria-label="التالي">›</button>' +
			'<span class="qei-lb-count" aria-live="polite"></span>'
		document.body.appendChild(lb)
		lb.addEventListener("click", (e) => {
			if (e.target === lb || e.target.classList.contains("qei-lb-close")) closeLb()
			if (e.target.classList.contains("qei-lb-next")) step(1)
			if (e.target.classList.contains("qei-lb-prev")) step(-1)
		})
		return lb
	}
	let lbList = [],
		lbIndex = 0
	function openLb(list, i) {
		lbList = list
		lbIndex = i
		const el = lightbox()
		el.classList.add("active")
		document.body.style.overflow = "hidden"
		render()
	}
	function closeLb() {
		if (lb) lb.classList.remove("active")
		document.body.style.overflow = ""
	}
	function step(d) {
		if (!lbList.length) return
		lbIndex = (lbIndex + d + lbList.length) % lbList.length
		render()
	}
	function render() {
		const el = lightbox();
		const current = lbList[lbIndex];
		if (!current) return;

		let mediaWrap = $(".qei-lb-media-wrap", el);
		if (!mediaWrap) {
			const oldImg = $("img", el);
			if (oldImg) oldImg.remove();
			mediaWrap = document.createElement("div");
			mediaWrap.className = "qei-lb-media-wrap";
			mediaWrap.style.cssText = "display:flex; align-items:center; justify-content:center; max-width:92vw; max-height:85vh;";
			const nextBtn = $(".qei-lb-next", el);
			el.insertBefore(mediaWrap, nextBtn);
		}

		const mediaSource = current.src || "";
		const rawFileName = mediaSource.split('/').pop() || 'gallery-main.jpg';
		const cleanFileName = encodeURIComponent(decodeURIComponent(rawFileName));
		const imgSrc2 = `assets/images/gallery/images/${cleanFileName}`;
		const imgSrc4 = `../assets/images/gallery/images/${cleanFileName}`;
		mediaWrap.innerHTML = `<img src="${mediaSource}" alt="${current.alt || ''}" style="max-width:92vw; max-height:82vh; object-fit:contain; border-radius:12px; box-shadow:0 10px 30px rgba(0,0,0,0.35);" onerror="if(this.src!=='${imgSrc2}') this.src='${imgSrc2}'; else if(this.src!=='${imgSrc4}') this.src='${imgSrc4}';" />`;
		$(".qei-lb-count", el).textContent = `${lbIndex + 1} / ${lbList.length}`;
	}

	function wireGallery() {
		const imgs = $$("img").filter((i) => {
			if (i.dataset.noLb || /logo|brand/i.test(i.src)) return false
			// Skip images wrapped in navigation links
			const parentA = i.closest("a")
			if (parentA) {
				const h = parentA.getAttribute("href") || ""
				if (h && h !== "#" && !h.startsWith("javascript:")) return false
			}
			return /gallery|صور|وسائط/.test(i.src + " " + i.alt) || i.closest("[class*='gallery']") || i.closest(".gallery-card")
		})
		const list = imgs.map((i) => ({ src: i.src, alt: i.alt || i.title || "صورة من معرض التدريب" }))

		if (list.length) {
			imgs.forEach((img, idx) => {
				if (img.dataset.qeiWired) return
				img.dataset.qeiWired = "1"
				img.style.cursor = "zoom-in"
				img.addEventListener("click", (e) => {
					if (document.querySelector(".main-nav.open")) return
					// Check if inside gallery detail viewer
					const viewerMain = img.closest(".gallery-viewer")?.querySelector(".gallery-main-image")
					if (img.closest(".gallery-thumbs") && viewerMain) {
						e.preventDefault()
						viewerMain.src = img.src
						return
					}
					openLb(list, idx)
				})
			})
		}

		for (const btn of $$("button, a")) {
			if (btn.tagName === "A") {
				const href = btn.getAttribute("href") || ""
				if (href && href !== "#" && !href.startsWith("javascript:")) continue
			}
			const txt = btn.textContent.trim()
			if (!/^(عرض جميع الصور|عرض الصور)$/.test(txt) || btn.dataset.qeiWired) continue
			btn.dataset.qeiWired = "1"
			btn.addEventListener("click", (e) => {
				e.preventDefault()
				if (document.querySelector(".main-nav.open")) return
				if (list.length) openLb(list, 0)
				else toast("لا توجد صور في هذا القسم", "error")
			})
		}
		// grid / list view toggle
		for (const btn of $$("button")) {
			if (btn.dataset.qeiWired) continue
			if (!/^[☷▦▤≡]$/.test(btn.textContent.trim())) continue
			const grid = gridFor(btn)
			if (!grid) continue
			btn.dataset.qeiWired = "1"
			btn.setAttribute("aria-label", "تبديل طريقة العرض")
			btn.addEventListener("click", (e) => {
				e.preventDefault()
				const on = grid.classList.toggle("qei-list-view")
				btn.classList.toggle("active", on)
				btn.setAttribute("aria-pressed", on ? "true" : "false")
			})
		}
	}

	/* ------------------------------------------------- 7. share + social links */

	const SHARE_BASE = {
		x: "https:/" + "/twitter.com/intent/tweet?url=",
		facebook: "https:/" + "/www.facebook.com/sharer/sharer.php?u=",
		linkedin: "https:/" + "/www.linkedin.com/sharing/share-offsite/?url=",
	}

	function wireShare() {
		const here = encodeURIComponent(location.href)
		const title = encodeURIComponent(document.title)
		const popup = (u) => window.open(u, "_blank", "noopener,width=640,height=560")

		for (const el of $$("button, a")) {
			if (el.dataset.qeiWired) continue
			const t = el.textContent.trim()
			const inShare = !!el.closest("[class*='share']")
			let handler = null

			if (t === "𝕏" || (t === "X" && inShare)) handler = () => popup(SHARE_BASE.x + here + "&text=" + title)
			else if (t === "f") handler = () => popup(SHARE_BASE.facebook + here)
			else if (t === "in" && inShare) handler = () => popup(SHARE_BASE.linkedin + here)
			else if (t === "🔗")
				handler = async () => {
					try {
						await navigator.clipboard.writeText(location.href)
						toast("تم نسخ رابط الصفحة")
					} catch (err) {
						toast("تعذّر النسخ، انسخ الرابط من شريط العنوان", "error")
					}
				}

			if (!handler) continue
			el.dataset.qeiWired = "1"
			if (!el.hasAttribute("aria-label")) el.setAttribute("aria-label", "مشاركة الصفحة")
			el.addEventListener("click", (e) => {
				e.preventDefault()
				handler()
			})
		}
	}

	// Footer social icons. They had href="#" and no destination in the source, so
	// they resolve from config.social - fill it in once the accounts are known.
	const SOCIAL_MAP = { in: "linkedin", "𝕏": "x", "▶": "youtube", "◎": "instagram" }
	const SOCIAL_NAME = { linkedin: "لينكدإن", x: "إكس", youtube: "يوتيوب", instagram: "إنستغرام" }
	function wireSocial() {
		for (const a of $$("a")) {
			const t = a.textContent.trim()
			const key = SOCIAL_MAP[t]
			const href = a.getAttribute("href")
			if (!key || a.dataset.qeiWired || !(href === "#" || !href || href.startsWith("javascript:"))) continue
			a.dataset.qeiWired = "1"
			a.setAttribute("aria-label", SOCIAL_NAME[key])
			a.setAttribute("rel", "noopener noreferrer")
			const target = config.social[key]
			if (target) {
				a.href = target
				a.target = "_blank"
			} else {
				a.addEventListener("click", (e) => {
					e.preventDefault()
					toast(`لم يتم ربط حساب ${SOCIAL_NAME[key]} بعد`, "error")
				})
			}
		}
	}

	/* -------------------------------------------------- 8. language toggle (EN) */

	const EN = {}

	/* Auto-load i18n-dict.js if not already loaded */
	function ensureI18nDict(onLoaded) {
		if (typeof window === "undefined") return
		if (window.QEI_I18N) {
			if (typeof onLoaded === "function") onLoaded()
			return
		}
		if (window._qeiDictLoading) {
			if (typeof onLoaded === "function") {
				window.addEventListener("qei-i18n-ready", onLoaded, { once: true })
			}
			return
		}
		window._qeiDictLoading = true
		const scripts = document.getElementsByTagName("script")
		for (const s of scripts) {
			if (s.src && s.src.includes("ui-runtime.js")) {
				const dictScript = document.createElement("script")
				dictScript.src = s.src.replace("ui-runtime.js", "i18n-dict.js")
				dictScript.onload = () => {
					window._qeiDictLoading = false
					window.dispatchEvent(new CustomEvent("qei-i18n-ready"))
					if (typeof onLoaded === "function") onLoaded()
					const currentLang = (localStorage.getItem("qei.lang") || "ar")
					if (currentLang === "en") {
						applyLang("en")
					}
				}
				dictScript.onerror = () => {
					window._qeiDictLoading = false
				}
				document.head.appendChild(dictScript)
				break
			}
		}
	}
	ensureI18nDict()

	function getTranslationDict() {
		return Object.assign({}, EN, window.QEI_I18N || {})
	}

	// Translate the dynamically-built mobile drawer on every language switch.
	// These nodes are created by wireMobileMenu() AFTER the first applyLang()
	// pass, so the generic text-node walker in applyLang() will not cover them
	// reliably. This helper re-runs the same translation logic against the
	// drawer's text nodes, using node._qeiAr (recorded once) as the source of
	// truth so switching back and forth stays stable.
	function translateDrawer(lang) {
		if (!window.QEI_I18N) return
		const en = lang === "en"
		const dict = getTranslationDict()

		const apply = (textNode) => {
			if (!textNode || textNode.nodeType !== Node.TEXT_NODE) return
			if (!textNode._qeiAr) textNode._qeiAr = textNode.nodeValue
			const original = textNode._qeiAr
			const normalized = original.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim()
			if (!normalized) return

			const translation = dict[original] || dict[normalized]
			if (en && translation) {
				const lead = /^\s/.test(original) ? " " : ""
				const trail = /\s$/.test(original) ? " " : ""
				textNode.nodeValue = lead + translation + trail
			} else if (!en) {
				textNode.nodeValue = original
			}
		}

		// Nav list items + call-to-action (label is the last span inside the inner wrapper)
		$$(".qei-drawer-item .qei-drawer-item-inner > span:last-child, .qei-drawer-cta .qei-drawer-item-inner > span:last-child")
			.forEach((el) => {
				if (el.firstChild && el.firstChild.nodeType === Node.TEXT_NODE) apply(el.firstChild)
			})

		// Drawer header brand subtitle
		const brand = $(".qei-drawer-brand-text small")
		if (brand && brand.firstChild && brand.firstChild.nodeType === Node.TEXT_NODE) apply(brand.firstChild)

		// Drawer footer static labels (skip phone numbers / emails)
		const footer = $(".qei-drawer-footer")
		if (footer) {
			const walker = document.createTreeWalker(footer, NodeFilter.SHOW_TEXT, {
				acceptNode(node) {
					const parent = node.parentElement
					if (!parent) return NodeFilter.FILTER_REJECT
					if (parent.classList.contains("ltr-num")) return NodeFilter.FILTER_REJECT
					const text = (node.nodeValue || "").trim()
					if (!text) return NodeFilter.FILTER_REJECT
					// Only translate nodes that actually contain Arabic text
					return /[\u0600-\u06FF]/.test(text) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT
				}
			})
			const nodes = []
			while (walker.nextNode()) nodes.push(walker.currentNode)
			nodes.forEach(apply)
		}
	}


	function qeiRuntimeTranslation(text, dict) {
		const normalized = String(text || '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim()
		if (!normalized) return null
		if (dict[normalized]) return dict[normalized]
		// Dynamic catalog description template: guarantee a complete English UI
		// even when the API returns an Arabic-only description.
		const programMatch = normalized.match(/^يقدم برنامج «(.+?)» تجربة تدريبية تطبيقية/)
		if (programMatch) {
			const enTitle = dict[programMatch[1]] || programMatch[1]
			return `The “${enTitle}” program provides a practical learning experience that helps participants turn concepts into workplace practices through applied exercises, case studies, and guided discussions tailored to organizational needs.`
		}
		let m = normalized.match(/^(\d+)\s*أيام?\s*[•·]\s*(\d+)\s*ساعة$/)
		if (m) return `${m[1]} days • ${m[2]} hours`
		m = normalized.match(/^(\d+)\s*ساعة تدريبية\s*\((\d+)\s*أيام?\)$/)
		if (m) return `${m[1]} training hours (${m[2]} days)`
		m = normalized.match(/^(\d+)\s*ساعة تدريبية$/)
		if (m) return `${m[1]} training hours`
		m = normalized.match(/^(\d+)\s*برنامجًا تدريبيًا$/)
		if (m) return `${m[1]} training programs`
		m = normalized.match(/^(\d+)\s*مجالًا تدريبيًا$/)
		if (m) return `${m[1]} training domains`
		m = normalized.match(/^(\d+)\s*عميلًا وشريكًا$/)
		if (m) return `${m[1]} clients & partners`
		m = normalized.match(/^تغطية مصورة من فعاليات معهد الجودة رقم\s*(\d+)$/)
		if (m) return `QEI Institute event gallery #${m[1]}`
		return null
	}

	function applyLang(lang) {
		if (!window.QEI_I18N) {
			ensureI18nDict(() => applyLang(lang))
		}
		const en = lang === "en"
		document.documentElement.lang = en ? "en" : "ar"
		document.documentElement.dir = en ? "ltr" : "rtl"
		const dict = getTranslationDict()

		// Walk all text nodes in document
		const walker = document.createTreeWalker(
			document.body || document.documentElement,
			NodeFilter.SHOW_TEXT,
			{
				acceptNode(node) {
					const parent = node.parentElement
					if (!parent) return NodeFilter.FILTER_REJECT
					const tag = parent.tagName.toUpperCase()
					if (tag === "SCRIPT" || tag === "STYLE" || tag === "CODE" || tag === "PRE" || tag === "NOSCRIPT") {
						return NodeFilter.FILTER_REJECT
					}
					if (parent.classList.contains("lang-btn")) {
						return NodeFilter.FILTER_REJECT
					}
					return NodeFilter.FILTER_ACCEPT
				}
			}
		)

		const textNodes = []
		while (walker.nextNode()) textNodes.push(walker.currentNode)

		for (const node of textNodes) {
			if (!node._qeiAr) {
				node._qeiAr = node.nodeValue
			}
			const original = node._qeiAr
			const normalized = original.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim()
			if (!normalized) continue

			const cleanNorm = normalized.replace(/[أإآ]/g, "ا").replace(/[\u064B-\u0652]/g, "")
			let translation = dict[original] || dict[normalized] || dict[cleanNorm]
			if (!translation) translation = qeiRuntimeTranslation(normalized, dict)
			if (!translation) {
				const symbolRegex = /^[▧▣▶★☏♙♟♣♧⚠✈✉✎✓➤⟳⬇🌐🎓🏛🏦👤💡💼📍📱🔒🛡‹›←→↑↓↔⇐⇒•\s?؟!.:-]+|[▧▣▶★☏♙♟♣♧⚠✈✉✎✓➤⟳⬇🌐🎓🏛🏦👤💡💼📍📱🔒🛡‹›←→↑↓↔⇐⇒•\s?؟!.:-]+$/g
				const strippedSymbol = normalized.replace(symbolRegex, "").trim()
				const cleanSymbol = strippedSymbol.replace(/[أإآ]/g, "ا").replace(/[\u064B-\u0652]/g, "")
				const matchedTrans = dict[strippedSymbol] || dict[cleanSymbol]
				if (matchedTrans) {
					const leadMatch = normalized.match(/^[▧▣▶★☏♙♟♣♧⚠✈✉✎✓➤⟳⬇🌐🎓🏛🏦👤💡💼📍📱🔒🛡‹›←→↑↓↔⇐⇒•\s]+/)
					const trailMatch = normalized.match(/[▧▣▶★☏♙♟♣♧⚠✈✉✎✓➤⟳⬇🌐🎓🏛🏦👤💡💼📍📱🔒🛡‹›←→↑↓↔⇐⇒•\s]+$/)
					const lead = leadMatch ? leadMatch[0] : ""
					let trail = trailMatch ? trailMatch[0] : ""
					if (trail.includes("←")) trail = trail.replace("←", "→")
					translation = lead + matchedTrans + trail
				}
			}

			if (en && translation) {
				const leadingSpace = /^\s/.test(original) ? " " : ""
				const trailingSpace = /\s$/.test(original) ? " " : ""
				node.nodeValue = leadingSpace + translation + trailingSpace
			} else if (!en) {
				node.nodeValue = original
			}
		}

		if (document.title) {
			if (!document._qeiArTitle) document._qeiArTitle = document.title
			const origTitle = document._qeiArTitle
			const normTitle = origTitle.replace(/\s+/g, " ").trim()
			const cleanTitle = normTitle.replace(/[أإآ]/g, "ا")
			const titleTrans = dict[origTitle] || dict[normTitle] || dict[cleanTitle]
			if (en && titleTrans) document.title = titleTrans
			else if (!en) document.title = origTitle
		}

		for (const input of $$("input[placeholder], textarea[placeholder]")) {
			if (!input.dataset.qeiArPh) {
				input.dataset.qeiArPh = input.placeholder
			}
			const originalPh = input.dataset.qeiArPh
			const normPh = originalPh.replace(/\s+/g, " ").trim()
			const cleanPh = normPh.replace(/[أإآ]/g, "ا").replace(/[\u064B-\u0652]/g, "")
			const phTranslation = dict[originalPh] || dict[normPh] || dict[cleanPh] || qeiRuntimeTranslation(normPh, dict)
			if (en && phTranslation) {
				input.placeholder = phTranslation
			} else if (!en) {
				input.placeholder = originalPh
			}
		}

		for (const input of $$('input[type="submit"], input[type="button"]')) {
			if (!input.value) continue
			if (!input.dataset.qeiArVal) {
				input.dataset.qeiArVal = input.value
			}
			const originalVal = input.dataset.qeiArVal
			const valTranslation = dict[originalVal] || dict[originalVal.trim()]
			if (en && valTranslation) {
				input.value = valTranslation
			} else if (!en) {
				input.value = originalVal
			}
		}


		// Translate user-visible attributes as well as text nodes.
		for (const el of $$('[title], [aria-label], img[alt]')) {
			for (const attr of ['title', 'aria-label', 'alt']) {
				if (!el.hasAttribute(attr)) continue
				const dataKey = 'qeiAr' + attr.replace(/(^|-)([a-z])/g, (_,a,b) => b.toUpperCase())
				if (!el.dataset[dataKey]) el.dataset[dataKey] = el.getAttribute(attr) || ''
				const originalAttr = el.dataset[dataKey]
				const normAttr = originalAttr.replace(/\s+/g, ' ').trim()
				const transAttr = dict[originalAttr] || dict[normAttr] || qeiRuntimeTranslation(normAttr, dict)
				if (en && transAttr) el.setAttribute(attr, transAttr)
				else if (!en) el.setAttribute(attr, originalAttr)
			}
		}

		for (const b of $$(".lang-btn")) {
			b.textContent = en ? "ع" : "EN"
		}
		for (const arr of $$(".qei-drawer-arrow")) {
			arr.innerHTML = en ? "&#x203A;" : "&#x2039;"
		}
		try {
			localStorage.setItem("qei.lang", lang)
		} catch (e) { }

		// Re-translate the dynamically-built mobile drawer (created after the
		// first applyLang pass) so its labels stay in sync with the current lang.
		translateDrawer(lang)

		setupLangObserver()
	}

	let langObserver = null
	function setupLangObserver() {
		if (langObserver || typeof window === "undefined" || !document.body) return
		let debounceTimer = null
		langObserver = new MutationObserver((mutations) => {
			if (debounceTimer) clearTimeout(debounceTimer)
			debounceTimer = setTimeout(() => {
				const currentLang = localStorage.getItem("qei.lang") || "ar"
				if (currentLang === "en") {
					applyLang("en")
				}
			}, 100)
		})
		langObserver.observe(document.body, { childList: true, subtree: true })
	}

	function wireLang() {
		for (const btn of $$(".lang-btn")) {
			if (btn.dataset.qeiWired) continue
			btn.dataset.qeiWired = "1"
			btn.type = "button"
			btn.setAttribute("aria-label", "تبديل لغة الواجهة")
			btn.addEventListener("click", (e) => {
				e.preventDefault()
				const next = (localStorage.getItem("qei.lang") || "ar") === "ar" ? "en" : "ar"
				applyLang(next)
				toast(next === "en" ? "Switched to English" : "تم التبديل إلى العربية")
			})
		}
		try {
			if (localStorage.getItem("qei.lang") === "en") applyLang("en")
		} catch (e) { }
	}

	/* ----------------------------------- 9. modals, accordions, mobile menu */

	let lastFocus = null
	function wireModals() {
		for (const m of $$(".modal-overlay")) {
			m.setAttribute("role", "dialog")
			m.setAttribute("aria-modal", "true")
			if (!m.hasAttribute("aria-label")) {
				const h = $("h1, h2, h3", m)
				m.setAttribute("aria-label", h ? h.textContent.trim() : "نافذة")
			}
		}
		// Login form inside the modal must validate instead of silently doing nothing.
		for (const m of $$(".modal-overlay")) {
			for (const form of $$("form", m)) {
				if (form.dataset.qeiWired) continue
				form.dataset.qeiWired = "1"
				form.addEventListener("submit", (e) => {
					e.preventDefault()
					if (!validate(form)) return
					toast("تم التحقق من البيانات، جارٍ تسجيل الدخول")
				})
			}
			// A modal with fields but no <form> still needs its primary button to validate.
			if (!$("form", m)) {
				const btn = $$("button", m).find((b) => /دخول|تسجيل|إرسال|متابعة/.test(b.textContent))
				if (btn && !btn.dataset.qeiWired && !btn.hasAttribute("onclick")) {
					btn.dataset.qeiWired = "1"
					btn.addEventListener("click", (e) => {
						e.preventDefault()
						if (!validate(m)) return
						toast("تم التحقق من البيانات")
					})
				}
			}
		}

		// Esc closes, focus is trapped, focus returns where it came from.
		document.addEventListener("keydown", (e) => {
			const open = $(".modal-overlay.active")
			if (e.key === "Escape") {
				if ($(".qei-lightbox.active")) return closeLb()
				if (open) open.classList.remove("active")
				const nav = $(".main-nav.open")
				if (nav) nav.classList.remove("open")
			}
			if ($(".qei-lightbox.active")) {
				if (e.key === "ArrowLeft") step(1)
				if (e.key === "ArrowRight") step(-1)
			}
			if (e.key === "Tab" && open) {
				const f = $$('a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])', open)
				if (!f.length) return
				const first = f[0],
					last = f[f.length - 1]
				if (e.shiftKey && document.activeElement === first) {
					e.preventDefault()
					last.focus()
				} else if (!e.shiftKey && document.activeElement === last) {
					e.preventDefault()
					first.focus()
				}
			}
		})

		// Wrap openModal/closeModal to manage focus without changing call sites.
		if (window.QEI && QEI.openModal && !QEI.openModal.qeiWrapped) {
			const open = QEI.openModal.bind(QEI)
			QEI.openModal = function (id) {
				lastFocus = document.activeElement
				open(id)
				const m = document.getElementById(id)
				if (m) {
					document.body.style.overflow = "hidden"
					const f = $('input, select, textarea, button:not(.modal-close-btn), a[href]', m)
					if (f) f.focus()
				}
			}
			QEI.openModal.qeiWrapped = true
			const close = QEI.closeModal.bind(QEI)
			QEI.closeModal = function (id) {
				close(id)
				document.body.style.overflow = ""
				if (lastFocus) lastFocus.focus()
			}
		}
	}

	function wireAccordions() {
		for (const h of $$(".accordion-header")) {
			const item = h.closest(".accordion-item")
			h.setAttribute("aria-expanded", item && item.classList.contains("open") ? "true" : "false")
			if (h.dataset.qeiWired) continue
			h.dataset.qeiWired = "1"
			h.addEventListener("click", () => {
				setTimeout(() => {
					const it = h.closest(".accordion-item")
					h.setAttribute("aria-expanded", it && it.classList.contains("open") ? "true" : "false")
				}, 0)
			})
			h.addEventListener("keydown", (e) => {
				if (e.key === "Enter" || e.key === " ") {
					e.preventDefault()
					h.click()
				}
			})
			if (!h.hasAttribute("tabindex") && h.tagName !== "BUTTON") h.setAttribute("tabindex", "0")
		}
	}

	function wireMobileMenu() {
		const btn = $("#mobileMenuBtn")
		const nav = $("#mainNav")
		if (!btn || !nav) return
		btn.setAttribute("aria-controls", "mainNav")

		// ---- Collect absolute URLs from existing nav links BEFORE building drawer ----
		const seen = new Set()
		const currentPath = location.pathname.toLowerCase()
		const linkData = []

		const getIcon = (txt, href) => {
			const s = (txt + " " + href).toLowerCase()
			if (/رئيسية|home|index/.test(s)) return '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>'
			if (/برامج|تدريب|program|calendar/.test(s)) return '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M18 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM6 4h5v8l-2.5-1.5L6 12V4z"/></svg>'
			if (/حلول|مؤسس|solution|custom/.test(s)) return '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 7V3H2v18h20V7H12zM6 19H4v-2h2v2zm0-4H4v-2h2v2zm0-4H4V9h2v2zm0-4H4V5h2v2zm4 12H8v-2h2v2zm0-4H8v-2h2v2zm0-4H8V9h2v2zm0-4H8V5h2v2zm10 12h-8v-2h2v-2h-2v-2h2v-2h-2V9h8v10zm-2-8h-2v2h2v-2zm0 4h-2v2h2v-2z"/></svg>'
			if (/مدير|إدار|management/.test(s)) return '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>'
			if (/عن المعهد|about|vision|methodology|impact/.test(s)) return '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z"/></svg>'
			if (/معرفة|خبر|مقالات|article|news/.test(s)) return '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/></svg>'
			if (/صور|معرض|gallery/.test(s)) return '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/></svg>'
			if (/تواصل|اتصل|contact|support|faq/.test(s)) return '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 1c-4.97 0-9 4.03-9 9v7c0 1.66 1.34 3 3 3h3v-8H5v-2c0-3.87 3.13-7 7-7s7 3.13 7 7v2h-4v8h3c1.66 0 3-1.34 3-3v-7c0-4.97-4.03-9-9-9z"/></svg>'
			if (/سياس|قانون|اعتماد|polic|terms|privacy/.test(s)) return '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/></svg>'
			if (/عملاء|شراك|client/.test(s)) return '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M20 6h-4V4c0-1.11-.89-2-2-2h-4c-1.11 0-2 .89-2 2v2H4c-1.11 0-1.99.89-1.99 2L2 19c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2zm-6 0h-4V4h4v2z"/></svg>'
			return '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>'
		}

		for (const a of $$("a", nav)) {
			if (a.closest(".qei-drawer-content")) continue // Ignore existing drawer links
			const attrHref = a.getAttribute("href") || ""
			if (!attrHref || attrHref === "#" || attrHref.startsWith("javascript:")) continue
			const text = (a._qeiAr || a.textContent).trim().replace(/[▾▸›‹]/g, "").trim()
			if (!text) continue
			const absHref = a.href // browser resolves to absolute URL
			if (seen.has(absHref)) continue
			seen.add(absHref)
			let isActive = a.classList.contains("active")
			try { isActive = isActive || currentPath === new URL(absHref).pathname.toLowerCase() } catch (e) { }
			linkData.push({ text, absHref, isActive, icon: getIcon(text, absHref) })
		}

		// Ensure all standard site navigation links exist in the drawer across all pages
		const standardLinks = [
			["الرئيسية", url("index.html")],
			["عن المعهد", url("about/about.html")],
			["رؤيتنا ورسالتنا", url("about/vision.html")],
			["البرامج التدريبية", url("programs/programs.html")],
			["حلول المؤسسات", url("solutions/solutions.html")],
			["عملاؤنا وشركاؤنا", url("about/clients.html")],
			["تواصل معنا", url("support/contact.html")],
			["المركز القانوني", url("policies/policies.html")],
			["لماذا تختارنا", url("about/why-choose-us.html")],
			["منهجية التدريب", url("about/methodology.html")],
			["الأثر المستدام", url("about/impact.html")],
			["الأسئلة الشائعة", url("support/faq.html")],
			["معرض الصور", url("gallery/gallery.html")],
		]

		for (const [text, absHref] of standardLinks) {
			if (!seen.has(absHref)) {
				seen.add(absHref)
				let isActive = false
				try { isActive = currentPath === new URL(absHref).pathname.toLowerCase() } catch (e) { }
				linkData.push({ text, absHref, isActive, icon: getIcon(text, absHref) })
			}
		}

		// ---- 100% Reliable Active Link Resolution based on location.href ----
		const normalizeUrlPath = (p) => {
			try {
				let s = new URL(p, location.href).pathname.toLowerCase().split("?")[0].split("#")[0]
				if (s.endsWith("/index.html")) s = s.slice(0, -10)
				if (s.length > 1 && s.endsWith("/")) s = s.slice(0, -1)
				return s || "/"
			} catch (e) {
				return ""
			}
		}

		const currNormPath = normalizeUrlPath(location.href)

		let bestMatchIndex = -1
		let bestMatchScore = -1

		linkData.forEach((item, idx) => {
			const itemNormPath = normalizeUrlPath(item.absHref)
			let score = 0

			if (currNormPath === itemNormPath && itemNormPath !== "/") {
				// Exact match on non-home page (e.g. /about/why-choose-us.html)
				score = 100
			} else if ((currNormPath === "/" || currNormPath === "" || currNormPath.endsWith("/index.html")) && (itemNormPath === "/" || itemNormPath === "" || itemNormPath.endsWith("/index.html"))) {
				// Exact match on home page
				score = 100
			} else if (item.isActive && score < 80) {
				// HTML explicit active class score
				score = 80
			} else if (currNormPath.includes("/policies/") && itemNormPath.includes("/policies/")) {
				// Section match for policy pages -> "المركز القانوني"
				score = 50
			} else if (currNormPath.includes("/programs/") && itemNormPath.includes("/programs/")) {
				// Section match for program pages -> "البرامج التدريبية"
				score = 50
			} else if (currNormPath.includes("/solutions/") && itemNormPath.includes("/solutions/")) {
				// Section match for solution pages -> "حلول المؤسسات"
				score = 50
			} else if (currNormPath.includes("/about/") && (itemNormPath.includes("/about/about.html") || itemNormPath === "/about")) {
				// Section match for about subpages -> "عن المعهد"
				score = 30
			} else if (currNormPath.includes("/support/faq") && itemNormPath.includes("/support/faq")) {
				score = 100
			} else if (currNormPath.includes("/support/contact") && itemNormPath.includes("/support/contact")) {
				score = 100
			} else if (currNormPath.includes("/gallery/") && itemNormPath.includes("/gallery/")) {
				score = 100
			}

			if (score > bestMatchScore) {
				bestMatchScore = score
				bestMatchIndex = idx
			}
		})

		// Fallback: If no match found and we are at root/home, default to Home
		if (bestMatchIndex === -1 && (currNormPath === "/" || currNormPath === "" || currNormPath.endsWith("/index.html"))) {
			bestMatchIndex = linkData.findIndex((l) => /رئيسية|index|home/i.test(l.text + " " + l.absHref))
		}

		// Apply final isActive to linkData
		linkData.forEach((item, idx) => {
			item.isActive = (idx === bestMatchIndex)
		})

		// ---- Remove old drawer, rebuild as DOM nodes ----
		const oldDrawer = nav.querySelector(".qei-drawer-content")
		if (oldDrawer) oldDrawer.remove()
		nav.classList.add("has-qei-drawer")

		const closeNav = () => {
			nav.classList.remove("open")
			document.body.classList.remove("qei-menu-open")
			btn.setAttribute("aria-expanded", "false")
		}

		const drawerContent = document.createElement("div")
		drawerContent.className = "qei-drawer-content"

		// Header
		const hdr = document.createElement("div")
		hdr.className = "qei-drawer-header"

		const brand = document.createElement("div")
		brand.className = "qei-drawer-brand"
		brand.innerHTML = `<img src="${url("assets/images/brand/qei-logo-white.png")}" alt="QEI" /><div class="qei-drawer-brand-text"><b>QEI Institute</b><small>معهد خبراء الجودة والتدريب</small></div>`
		const brandSub = brand.querySelector(".qei-drawer-brand-text small")
		if (brandSub && brandSub.firstChild && brandSub.firstChild.nodeType === Node.TEXT_NODE) {
			brandSub.firstChild._qeiAr = "معهد خبراء الجودة والتدريب"
		}

		const xBtn = document.createElement("button")
		xBtn.className = "qei-drawer-close"
		xBtn.setAttribute("aria-label", "إغلاق القائمة")
		xBtn.textContent = "✕"
		xBtn.addEventListener("click", (e) => { e.preventDefault(); e.stopPropagation(); closeNav() })

		hdr.appendChild(brand)
		hdr.appendChild(xBtn)
		drawerContent.appendChild(hdr)

		// Body
		const bodyEl = document.createElement("div")
		bodyEl.className = "qei-drawer-body"

		const navList = document.createElement("div")
		navList.className = "qei-drawer-nav-list"

		for (const l of linkData) {
			const a = document.createElement("a")
			a.href = l.absHref
			a.className = "qei-drawer-item" + (l.isActive ? " active" : "")
			a.innerHTML = `<span class="qei-drawer-item-inner">${l.icon}<span>${l.text}</span></span><span class="qei-drawer-arrow">&#x2039;</span>`

			// Record the original Arabic label so language toggling stays stable
			const labelNode = a.querySelector(".qei-drawer-item-inner > span:last-child")
			if (labelNode && labelNode.firstChild && labelNode.firstChild.nodeType === Node.TEXT_NODE) {
				labelNode.firstChild._qeiAr = (l._qeiAr || l.text)
			}

			a.addEventListener("click", function (e) {
				e.stopPropagation()
				closeNav()

				let targetUrl
				try {
					targetUrl = new URL(l.absHref, window.location.href)
				} catch (err) {
					targetUrl = null
				}

				if (targetUrl) {
					const currentUrl = new URL(window.location.href)
					const isSamePath = targetUrl.pathname.toLowerCase() === currentUrl.pathname.toLowerCase()

					if (isSamePath) {
						if (targetUrl.hash) {
							const targetEl = document.querySelector(targetUrl.hash)
							if (targetEl) {
								e.preventDefault()
								targetEl.scrollIntoView({ behavior: "smooth" })
								try { history.pushState(null, "", targetUrl.hash) } catch (err) { }
								return
							}
						} else {
							e.preventDefault()
							window.scrollTo({ top: 0, behavior: "smooth" })
							return
						}
					}
				}

				// Cross-page navigation: execute SYNCHRONOUSLY (no setTimeout) so mobile browser allows navigation
				e.preventDefault()
				window.location.href = l.absHref
			})
			navList.appendChild(a)
		}

		const ctaHref = url("registration/registration-personal.html?source=header")
		const cta = document.createElement("a")
		cta.href = ctaHref
		cta.className = "qei-drawer-cta"
		cta.innerHTML = `<span class="qei-drawer-item-inner"><svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg><span>سجل الآن</span></span><span class="qei-drawer-arrow">&#x2039;</span>`
		const ctaLabelNode = cta.querySelector(".qei-drawer-item-inner > span:last-child")
		if (ctaLabelNode && ctaLabelNode.firstChild && ctaLabelNode.firstChild.nodeType === Node.TEXT_NODE) {
			ctaLabelNode.firstChild._qeiAr = "سجل الآن"
		}
		cta.addEventListener("click", function (e) {
			e.stopPropagation()
			closeNav()
			e.preventDefault()
			window.location.href = ctaHref
		})
		navList.appendChild(cta)
		bodyEl.appendChild(navList)

		const footerEl = document.createElement("div")
		footerEl.className = "qei-drawer-footer"
		footerEl.innerHTML = `
			<a href="tel:+966567167988" class="qei-drawer-contact-item">
				<span class="qei-drawer-contact-icon">
					<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M6.62 10.79a15.053 15.053 0 006.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/></svg>
				</span>
				<span class="ltr-num">+966 56 716 7988</span>
			</a>
			<a href="mailto:info@qeinst.com" class="qei-drawer-contact-item">
				<span class="qei-drawer-contact-icon">
					<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/></svg>
				</span>
				<span>info@qeinst.com</span>
			</a>
			<div class="qei-drawer-social">
				<a href="https://www.youtube.com/@qeinst" target="_blank" class="qei-drawer-social-link" aria-label="YouTube">
					<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
				</a>
				<a href="https://wa.me/966567167988" target="_blank" class="qei-drawer-social-link" aria-label="WhatsApp">
					<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.205 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/></svg>
				</a>
				<a href="https://x.com/T100_i" target="_blank" class="qei-drawer-social-link" aria-label="X">
					<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
				</a>
				<a href="https://www.linkedin.com/company/%D9%85%D8%B9%D9%87%D8%AF-%D8%AE%D8%A8%D8%B1%D8%A7%D8%A1-%D8%A7%D9%84%D8%AC%D9%88%D8%AF%D8%A9-%D9%84%D9%84%D8%AA%D8%AF%D8%B1%D9%8A%D8%A8/" target="_blank" class="qei-drawer-social-link" aria-label="LinkedIn">
					<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.88 8.56a1.68 1.68 0 0 0 1.68-1.68c0-.93-.75-1.69-1.68-1.69a1.69 1.69 0 0 0-1.69 1.69c0 .93.76 1.68 1.69 1.68m1.39 9.94v-8.37H5.5v8.37h2.77z"/></svg>
				</a>
			</div>`
		bodyEl.appendChild(footerEl)
		drawerContent.appendChild(bodyEl)

		nav.insertBefore(drawerContent, nav.firstChild)

		try {
			const curLang = localStorage.getItem("qei.lang") || "ar"
			if (curLang === "en") {
				applyLang("en")
			}
			// Always sync the freshly built drawer to the current language.
			translateDrawer(curLang)
		} catch (e) { }

		// ---- Hamburger button ----
		if (!btn.dataset.qeiWired) {
			btn.dataset.qeiWired = "true"
			btn.addEventListener("click", (e) => {
				e.preventDefault()
				e.stopPropagation()
				const isOpen = nav.classList.toggle("open")
				document.body.classList.toggle("qei-menu-open", isOpen)
				btn.setAttribute("aria-expanded", isOpen ? "true" : "false")
			})
		}

		// ---- Close on outside click ----
		document.addEventListener("click", (e) => {
			if (nav.classList.contains("open") && !nav.contains(e.target) && e.target !== btn) {
				closeNav()
				document._qeiNavClosedTs = Date.now()
			}
		})
	}

	/* -------------------------------------------- generic form + search wiring */

	function wireFormsLegacyDisabled1() {
		for (const form of $$("form")) {
			if (form.dataset.qeiWired || form.closest(".modal-overlay")) continue
			form.dataset.qeiWired = "1"
			form.setAttribute("novalidate", "") // we render Arabic messages ourselves
			if (form.id === "quickSearchForm") continue // handled by app.js
			form.addEventListener(
				"submit",
				(e) => {
					if (!validate(form)) {
						e.preventDefault()
						e.stopImmediatePropagation()
						return
					}
					// Search forms filter in place; other forms report success.
					const isSearch = /search|بحث/i.test(form.className + " " + form.id)
					if (isSearch) {
						e.preventDefault()
						const q = norm((fields(form)[0] || {}).value || "")
						const grid = gridFor(form)
						if (grid) {
							let shown = 0
							for (const card of $$(CARD_SEL, grid)) {
								const show = !q || norm(card.textContent).includes(q)
								card.hidden = !show
								card.style.display = show ? "" : "none"
								if (show) shown++
							}
							ensureEmptyState(grid).hidden = shown > 0
							toast(shown ? `تم العثور على ${shown} نتيجة` : "لا توجد نتائج مطابقة", shown ? "success" : "error")
						} else {
							api.go("support/search-results.html?q=" + encodeURIComponent(q))
						}
						return
					}

					// Contact Form Integration with Backend API
					if (form.classList.contains("contact-form") || /contact/i.test(location.pathname)) {
						e.preventDefault()
						const payload = {}
						fields(form).forEach(f => {
							const val = f.value.trim()
							if (!val) return
							if (f.type === "email") payload.email = val
							else if (f.tagName === "SELECT") payload.subject = val
							else if (f.tagName === "TEXTAREA") payload.message = val
							else if (!payload.full_name) payload.full_name = val
						})

						if (window.QEIAPI && typeof window.QEIAPI.submitContactMessage === "function") {
							window.QEIAPI.submitContactMessage(payload).then(res => {
								toast(res.message || "تم إرسال رسالتكم بنجاح!")
								form.reset()
							}).catch(err => {
								toast(err.message || "تعذر إرسال الرسالة للسيرفر", "error")
							})
						} else {
							toast("تم إرسال رسالتكم بنجاح!")
						}
						return
					}

					// Corporate / Custom Training Form Integration with Backend API
					if (form.classList.contains("custom-request-form") || /custom-training/i.test(location.pathname)) {
						e.preventDefault()
						const formData = new FormData(form)
						// Add un-named fields fallback
						const inputs = fields(form)
						const payload = {
							applicant_name: (inputs[0] && inputs[0].value) || "",
							company_name: (inputs[1] && inputs[1].value) || "",
							phone: (inputs[2] && inputs[2].value) || "",
							email: (inputs[3] && inputs[3].value) || "",
							trainees_count: (inputs[4] && inputs[4].value) || "",
							training_field: (inputs[5] && inputs[5].value) || "",
							need_description: (form.querySelector("textarea") && form.querySelector("textarea").value) || "",
							preferred_date: (form.querySelector("input[type='date']") && form.querySelector("input[type='date']").value) || "",
							execution_mode: (inputs[7] && inputs[7].value) || "عن بُعد",
						}

						if (window.QEIAPI && typeof window.QEIAPI.submitCorporateRequest === "function") {
							window.QEIAPI.submitCorporateRequest(payload).then(res => {
								toast(res.message || "تم إرسال طلب التدريب الخاص بنجاح!")
								api.go("registration/request-success.html")
							}).catch(err => {
								toast(err.message || "تعذر إرسال الطلب للسيرفر", "error")
							})
						} else {
							api.go("registration/request-success.html")
						}
						return
					}
				},
				true,
			)
		}

		// Registration pages: restore what was typed before, and save on the way out.
		if (/registration-/.test(location.pathname)) {
			const form = $("main form")
			if (form) {
				restoreRegForm(form)
				form.addEventListener("change", () => saveRegForm(form))
			}
		}
	}

	// Prefill the search box on the results page from ?q=
	function wireSearchResultsLegacyDisabled1() {
		const q = new URLSearchParams(location.search).get("q")
		if (!q) return
		const input = $("#searchQueryResult") || $("input[type='search'], input[placeholder*='ابحث']")
		if (input) input.value = q
	}

	/* --------------------------- 10. accessible names for every field (runtime) */

	// Doing this at runtime instead of in the markup: the browser knows the real
	// accessible name (label[for], wrapping <label>, aria-*), so nothing is
	// mislabelled twice and no page needs 400 hand-written attributes.
	function wireFieldNames() {
		for (const f of $$("input, select, textarea")) {
			if (["hidden", "submit", "button", "reset"].includes(f.type)) continue
			const named =
				(f.id && $('label[for="' + f.id + '"]')) ||
				f.closest("label") ||
				f.getAttribute("aria-label") ||
				f.getAttribute("aria-labelledby")
			if (named) continue

			let name = f.placeholder || ""
			if (!name) {
				const box = f.closest(".wiz-field, .input-group, .form-row, .field, .form-group") || f.parentElement
				const lbl = box && box.querySelector("label, .input-label, .field-label, h4, h5, b, strong")
				if (lbl) name = lbl.textContent || ""
			}
			name = name
				.replace(/[*\u2022\u25cf]/g, " ")
				.replace(/\s+/g, " ")
				.trim()
			if (!name) name = f.tagName === "SELECT" ? "قائمة اختيار" : "حقل إدخال"
			f.setAttribute("aria-label", name)
		}
	}

	/* ------------------------------ 11. training calendar: views, today, reset */

	function wireCalendar() {
		const toolbar = $(".tc-toolbar")
		if (!toolbar) return
		const cal = $(".tc-calendar")
		const views = $$("button", toolbar).filter((b) => /^(شهر|أسبوع|قائمة)$/.test(b.textContent.trim()))

		for (const b of views) {
			if (b.dataset.qeiWired) continue
			b.dataset.qeiWired = "1"
			b.type = "button"
			b.setAttribute("aria-pressed", b.classList.contains("active") ? "true" : "false")
			b.addEventListener("click", () => {
				const mode = b.textContent.trim()
				for (const v of views) {
					const on = v === b
					v.classList.toggle("active", on)
					v.setAttribute("aria-pressed", on ? "true" : "false")
				}
				if (cal) {
					cal.classList.remove("tc-view-week", "tc-view-list")
					if (mode === "أسبوع") cal.classList.add("tc-view-week")
					if (mode === "قائمة") cal.classList.add("tc-view-list")
				}
			})
		}

		for (const b of $$("button", toolbar.parentElement || toolbar)) {
			if (b.dataset.qeiWired || b.textContent.trim() !== "اليوم") continue
			b.dataset.qeiWired = "1"
			b.type = "button"
			b.addEventListener("click", () => {
				const today = String(new Date().getDate())
				let hit = null
				for (const cell of $$(".tc-days > *")) {
					const isToday = cell.textContent.trim().startsWith(today)
					cell.classList.toggle("tc-today", isToday)
					if (isToday && !hit) hit = cell
				}
				if (hit) hit.scrollIntoView({ block: "center", behavior: "smooth" })
				else toast("اليوم الحالي خارج الشهر المعروض", "error")
			})
		}
	}

	/* --------------------------- 12. programs listing: sort, filters, sidebar */

	const SORTS = [
		{ label: "الأحدث", short: "الأحدث", key: null },
		{ label: "الأعلى تقييمًا", short: "التقييم", key: "rating" },
	]

	const numFrom = (text, re) => {
		const m = String(text).match(re)
		return m ? parseFloat(m[1].replace(/,/g, "")) : null
	}

	function wireProgramsListingLegacyFiltersDisabled() {
		const side = $(".pl-filters")
		const grid = side ? gridFor(side) : null

		// "إظهار الفلاتر" toggles the sidebar (it is hidden on narrow screens)
		for (const b of $$("button")) {
			if (!/إظهار الفلاتر|الفلاتر/.test(b.textContent) || b.dataset.qeiWired || !side) continue
			b.dataset.qeiWired = "1"
			b.type = "button"
			b.setAttribute("aria-controls", "plFilters")
			side.id = side.id || "plFilters"
			b.addEventListener("click", (e) => {
				e.preventDefault()
				const on = side.classList.toggle("qei-filters-open")
				b.setAttribute("aria-expanded", on ? "true" : "false")
				if (on) side.scrollIntoView({ block: "start", behavior: "smooth" })
			})
		}

		if (!grid) return
		const cards = $$(CARD_SEL, grid)
		if (!cards.length) return
		const originalOrder = cards.slice()

		// Sort button cycles through real sort orders read from the cards themselves.
		const sortBtn = $$("button").find((b) => /ترتيب حسب/.test(b.textContent) && !b.dataset.qeiWired)
		if (sortBtn) {
			sortBtn.dataset.qeiWired = "1"
			sortBtn.type = "button"
			let idx = 0
			sortBtn.addEventListener("click", (e) => {
				e.preventDefault()
				idx = (idx + 1) % SORTS.length
				const mode = SORTS[idx]
				let list = originalOrder.slice()
				if (mode.key === "rating")
					list.sort((a, b2) => (numFrom(b2.textContent, /([\d.]+)\s*★|★\s*([\d.]+)/) || 0) - (numFrom(a.textContent, /([\d.]+)\s*★|★\s*([\d.]+)/) || 0))
				if (mode.key === "price")
					list.sort((a, b2) => (numFrom(a.textContent, /([\d,]+)\s*ر\.?س/) || Infinity) - (numFrom(b2.textContent, /([\d,]+)\s*ر\.?س/) || Infinity))
				list.forEach((c) => grid.appendChild(c))
				const strong = sortBtn.querySelector("b")
				if (strong) strong.textContent = (mode.short || mode.label) + "⌄"
				toast("تم الترتيب حسب: " + mode.label)
			})
		}

		// The other toolbar dropdowns point at the matching sidebar section.
		for (const b of $$("button")) {
			const t = b.textContent.trim().replace(/⌄/g, "")
			if (b.dataset.qeiWired || !/^(المجال|المستوى|طريقة التنفيذ|المدة|التاريخ)$/.test(t)) continue
			b.dataset.qeiWired = "1"
			b.type = "button"
			b.addEventListener("click", (e) => {
				e.preventDefault()
				const target = $$("h3, h4", side || document).find((h) => h.textContent.trim().replace(/⌄/g, "") === t)
				if (side) {
					side.classList.add("qei-filters-open")
				}
				if (target) {
					target.scrollIntoView({ block: "center", behavior: "smooth" })
					const first = target.parentElement && target.parentElement.querySelector("input")
					if (first) first.focus()
				} else toast("لا توجد خيارات لهذا الفلتر", "error")
			})
		}

		// Sidebar checkboxes really filter: OR inside a group, AND across groups.
		const groups = $$("section", side || document).filter((s) => $$('input[type="checkbox"]', s).length)
		if (!groups.length) return
		const termOf = (input) => {
			const label = input.closest("label")
			if (!label) return ""
			const clone = label.cloneNode(true)
			clone.querySelectorAll("small, input").forEach((n) => n.remove())
			return norm(clone.textContent)
		}
		const apply = () => {
			let shown = 0
			for (const card of cards) {
				const text = norm(card.textContent)
				let ok = true
				for (const g of groups) {
					const checked = $$('input[type="checkbox"]:checked', g)
					if (!checked.length) continue
					if (!checked.some((c) => text.includes(termOf(c)))) {
						ok = false
						break
					}
				}
				card.hidden = !ok
				card.style.display = ok ? "" : "none"
				if (ok) shown++
			}
			const badge = $("#programCountBadge")
			if (badge) badge.textContent = String(shown)
			ensureEmptyState(grid).hidden = shown > 0
		}
		for (const cb of $$('input[type="checkbox"]', side || document)) {
			if (cb.dataset.qeiWired) continue
			cb.dataset.qeiWired = "1"
			cb.addEventListener("change", apply)
		}

		const searchInput = $('input[type="search"]', document);
		if (searchInput && !searchInput.dataset.qeiWired) {
			searchInput.dataset.qeiWired = "1";
			searchInput.addEventListener("input", () => {
				const term = searchInput.value.toLowerCase().trim();
				let shown = 0;
				for (const card of cards) {
					const match = !term || card.textContent.toLowerCase().includes(term);
					card.hidden = !match;
					card.style.display = match ? "" : "none";
					if (match) shown++;
				}
				ensureEmptyState(grid).hidden = shown > 0;
				if (grid.parentElement.querySelector(".pl-pagination")) {
					setupDynamicPagination(grid, ".pl-pagination", 15);
				}
			});
		}
	}

	/* ------------------------- 13. save program, refresh news, thumb scrolling */

	function wireMisc() {
		// Save / bookmark a program
		for (const b of $$("button")) {
			if (!/احفظ البرنامج|احفط البرنامج/.test(b.textContent) || b.dataset.qeiWired) continue
			b.dataset.qeiWired = "1"
			b.type = "button"
			const id = (document.title || location.pathname).trim()
			const read = () => {
				try {
					return JSON.parse(localStorage.getItem("qei.saved") || "[]")
				} catch (e) {
					return []
				}
			}
			const sync = () => {
				const on = read().includes(id)
				b.setAttribute("aria-pressed", on ? "true" : "false")
				b.textContent = on ? "✔ محفوظ لديك" : "▮ احفظ البرنامج"
			}
			sync()
			b.addEventListener("click", (e) => {
				e.preventDefault()
				const list = read()
				const i = list.indexOf(id)
				if (i >= 0) list.splice(i, 1)
				else list.push(id)
				try {
					localStorage.setItem("qei.saved", JSON.stringify(list))
				} catch (err) { }
				sync()
				toast(i >= 0 ? "تم إزالة البرنامج من المحفوظات" : "تم حفظ البرنامج")
			})
		}

		// "تحديث عند توفر أخبار جديدة"
		for (const b of $$("button")) {
			if (!/تحديث عند توفر/.test(b.textContent) || b.dataset.qeiWired) continue
			b.dataset.qeiWired = "1"
			b.type = "button"
			b.addEventListener("click", (e) => {
				e.preventDefault()
				b.disabled = true
				const old = b.textContent
				b.textContent = "جارٍ التحديث…"
				setTimeout(() => location.reload(), 700)
				setTimeout(() => {
					b.disabled = false
					b.textContent = old
				}, 4000)
			})
		}

		// Thumbnail strip arrows
		const strip = $(".gallery-thumbs")
		if (strip) {
			for (const b of $$("button", strip)) {
				if (b.dataset.qeiWired) continue
				const t = b.textContent.trim()
				if (t !== "‹" && t !== "›") continue
				b.dataset.qeiWired = "1"
				b.type = "button"
				b.setAttribute("aria-label", t === "‹" ? "الصور التالية" : "الصور السابقة")
				b.addEventListener("click", (e) => {
					e.preventDefault()
					strip.scrollBy({ left: t === "‹" ? 260 : -260, behavior: "smooth" })
				})
			}
			// Clicking a thumbnail swaps the main image.
			const main = $(".gallery-feature img") || $(".gallery-viewer img")
			for (const img of $$("img", strip)) {
				if (img.dataset.qeiThumb) continue
				img.dataset.qeiThumb = "1"
				img.style.cursor = "pointer"
				img.setAttribute("tabindex", "0")
				const swap = () => {
					if (main && main !== img) {
						const prev = main.src
						main.src = img.src
						img.src = prev
					}
				}
				img.addEventListener("click", swap)
				img.addEventListener("keydown", (e) => {
					if (e.key === "Enter") swap()
				})
			}
		}
	}

	/* ------------------------------- 14. leftover chip groups (visual select) */

	// Sector chips and schedule chips have no grid to filter on some pages; they
	// still need to respond to a click, so they behave as a selectable group.
	function wireChipToggles() {
		for (const btn of $$("button")) {
			if (btn.dataset.qeiWired || btn.hasAttribute("onclick")) continue
			const p = btn.parentElement
			if (!p) continue
			const sibs = $$(":scope > button", p).filter((b) => !b.hasAttribute("onclick"))
			if (sibs.length < 2) continue
			for (const b of sibs) {
				if (b.dataset.qeiWired) continue
				b.dataset.qeiWired = "1"
				b.type = b.type || "button"
				b.setAttribute("aria-pressed", b.classList.contains("active") ? "true" : "false")
				b.addEventListener("click", (e) => {
					e.preventDefault()
					for (const s of sibs) {
						const on = s === b
						s.classList.toggle("active", on)
						s.setAttribute("aria-pressed", on ? "true" : "false")
					}
					// If there is anything card-like nearby, filter it too.
					const grid = gridFor(b)
					if (!grid) return
					const term = norm(b.textContent)
					let shown = 0
					for (const card of $$(CARD_SEL, grid)) {
						const show = !term || /^(الكل|كل المواعيد)$/.test(term) || norm(card.textContent).includes(term)
						card.hidden = !show
						card.style.display = show ? "" : "none"
						if (show) shown++
					}
					ensureEmptyState(grid).hidden = shown > 0
				})
			}
		}
	}


	/* ------------------- 15. dropdown filters, clear search, lightbox fallback */

	// Every rebuilt dropdown carries data-filter, so one handler makes all of
	// them filter the nearest card list. An empty value means "no filter".
	function wireSelectFilters() {
		const sels = $$("select[data-filter]").filter((s) => !s.closest("#quickSearchForm"))
		if (!sels.length) return
		const grid = gridFor(sels[0])
		if (!grid) return
		const cards = $$(CARD_SEL, grid)
		if (!cards.length) return

		const apply = () => {
			const terms = sels.map((s) => norm(s.value)).filter((v) => v && !/جميع|الكل/.test(v))
			let shown = 0
			for (const card of cards) {
				const text = norm(card.textContent)
				const ok = terms.every((t) => text.includes(t))
				card.hidden = !ok
				card.style.display = ok ? "" : "none"
				if (ok) shown++
			}
			ensureEmptyState(grid).hidden = shown > 0
			const srEmpty = $(".sr-empty")
			if (srEmpty) srEmpty.style.display = shown ? "none" : ""
			const loading = $(".sr-loading")
			if (loading) loading.style.display = "none"
		}

		for (const s of sels) {
			if (s.dataset.qeiWired) continue
			s.dataset.qeiWired = "1"
			s.addEventListener("change", apply)
		}
		apply()
	}

	// Used by the "clear search and filters" button on the empty-results state.
	function clearSearch() {
		for (const s of $$("select[data-filter]")) s.selectedIndex = 0
		for (const i of $$('.sr-filters input, .tc-filters input, input[type="search"]')) i.value = ""
		for (const cb of $$('input[type="checkbox"]:checked')) {
			if (cb.closest(".pl-filters, .sr-filters, .tc-filters")) cb.checked = false
		}
		for (const card of $$(CARD_SEL)) {
			card.hidden = false
			card.style.display = ""
		}
		for (const e of $$(".qei-empty")) e.hidden = true
		const srEmpty = $(".sr-empty")
		if (srEmpty) srEmpty.style.display = "none"
		for (const b of $$('button[aria-pressed="true"]')) b.setAttribute("aria-pressed", "false")
		toast("تم مسح البحث والفلاتر")
	}

	// Some thumbnails sit under a decorative overlay, so a click never reaches the
	// image itself. This delegated fallback resolves the image from the container.
	function wireLightboxFallback() {
		if (document.documentElement.dataset.qeiLbFallback) return
		document.documentElement.dataset.qeiLbFallback = "1"
		document.addEventListener("click", (e) => {
			if (e.target.closest("a, button, input, select, textarea, .qei-lightbox")) return
			// If the mobile nav was just closed (same click), do not open the lightbox.
			if (document._qeiNavClosedTs && Date.now() - document._qeiNavClosedTs < 200) return
			let img = e.target.tagName === "IMG" ? e.target : null
			if (!img && e.target.querySelector) img = e.target.querySelector("img[data-qei-wired]")
			if (!img || !img.dataset.qeiWired) return
			if (document.querySelector(".qei-lightbox.active")) return
			img.dispatchEvent(new MouseEvent("click", { bubbles: false }))
		})
	}

	/* ---------------------------------- Global Link Routing & Dynamic Pages */

	function wireGlobalNavigation() {
		document.addEventListener("click", (e) => {
			const a = e.target.closest("a")
			if (!a) return
			const href = a.getAttribute("href")
			if (!href || href === "#top" || href === "#" || href.startsWith("javascript:") || a.target === "_blank") return

			// Handle Hash Routes in Multipage mode
			if (href.startsWith("#")) {
				if (href.startsWith("#program/")) {
					e.preventDefault()
					const id = href.replace("#program/", "")
					const prg = (window.QEI && window.QEI.programs) ? window.QEI.programs.find(p => p.id === id) : null
					const target = (prg && prg.status === "closed") ? "programs/closed-program.html?id=" + id : "programs/program-details.html?id=" + id
					location.href = url(target)
					return
				}
				if (href.startsWith("#trainer/")) {
					e.preventDefault()
					location.href = url("about/about.html#trainer-" + href.replace("#trainer/", ""))
					return
				}
				if (href.startsWith("#search?")) {
					e.preventDefault()
					const q = href.split("?q=")[1] || ""
					location.href = url("support/search-results.html?q=" + q)
					return
				}
				const HASH_MAP = {
					"#home": "index.html",
					"#programs": "programs/programs.html",
					"#solutions": "solutions/solutions.html",
					"#about": "about/about.html",
					"#policies": "policies/policies.html",
					"#contact": "support/contact.html",
					"#certificates": "about/clients.html",
					"#clients": "about/clients.html",
					"#accreditations": "about/clients.html",
					"#partners": "about/clients.html",
					"#sectors": "solutions/solutions.html"
				}
				if (HASH_MAP[href]) {
					e.preventDefault()
					location.href = url(HASH_MAP[href])
					return
				}
			}
		})
	}

	function wireProgramDetailsLegacyDisabled1() {
		if (!/program-details/.test(location.pathname)) return
		const id = new URLSearchParams(location.search).get("id")
		if (!id || !window.QEI || !window.QEI.programs) return
		const prg = window.QEI.programs.find((p) => p.id === id)
		if (!prg) return

		const h1 = $("h1")
		if (h1) h1.textContent = prg.title
		document.title = `${prg.title} | QEI — معهد خبراء الجودة للتدريب`

		const pHero = $(".pd-copy > p")
		if (pHero) pHero.textContent = prg.desc

		const metaItems = $$(".pd-meta > span")
		if (metaItems.length >= 3) {
			metaItems[0].textContent = `⌖ ${prg.location}`
			metaItems[1].textContent = `▣ ${prg.mode}`
			metaItems[2].textContent = `◷ ${prg.duration}`
		}

		const priceEl = $(".pd-copy > strong")
		if (priceEl) priceEl.style.display = "none"

		if (prg.outcomes && prg.outcomes.length) {
			const outcomesUl = $(".pd-outcomes ul")
			if (outcomesUl) {
				outcomesUl.innerHTML = prg.outcomes.map((o) => `<li>✓ ${o}</li>`).join("")
			}
		}
	}

	function wireDateGridLegacyDisabled1() {
		const grid = $(".rgs-date-grid")
		const tools = $(".rgs-date-tools")

		if (tools) {
			const toolBtns = $$("button", tools)
			toolBtns.forEach((btn) => {
				btn.addEventListener("click", (e) => {
					e.preventDefault()
					const group = btn.parentElement
					if (group) {
						for (const sibling of $$("button", group)) {
							sibling.classList.remove("active", "green")
						}
					}
					btn.classList.add("active")
					filterDateCards()
				})
			})
		}

		function filterDateCards() {
			if (!grid || !tools) return
			const activeModeBtn = $(".rgs-date-tools > div:first-child button.active", tools) || $(".rgs-date-tools button.active", tools)
			const activeTimeBtn = $(".rgs-date-tools > div:last-child button.active", tools)

			const modeText = activeModeBtn ? norm(activeModeBtn.textContent) : ""
			const timeText = activeTimeBtn ? norm(activeTimeBtn.textContent) : ""

			const labels = $$("label", grid)
			labels.forEach((label) => {
				const cardText = norm(label.textContent)
				let matchesMode = true
				if (modeText && modeText !== "كل المواعيد" && modeText !== "الكل") {
					matchesMode = cardText.includes(modeText)
				}

				let matchesTime = true
				if (timeText === "صباحي") {
					matchesTime = /0[89]:|10:|11:/.test(cardText) || cardText.includes("صباح")
				} else if (timeText === "مسائي") {
					matchesTime = /1[2-9]:|2[0-3]:/.test(cardText) || cardText.includes("مساء")
				}

				const show = matchesMode && matchesTime
				label.style.display = show ? "" : "none"
			})
		}

		if (!grid) return

		grid.addEventListener("click", (e) => {
			const label = e.target.closest("label")
			if (!label || !grid.contains(label)) return

			const input = $("input[type='radio']", label)
			if (input && input.disabled) {
				e.preventDefault()
				toast("هذا الموعد مكتمل وغير متاح للتسجيل", "error")
				return
			}

			for (const l of $$("label", grid)) {
				l.classList.remove("selected")
				const icon = $("i", l)
				if (icon) icon.textContent = ""
			}

			label.classList.add("selected")
			if (input) input.checked = true
			const icon = $("i", label)
			if (icon) icon.textContent = "✓"
		})
	}

	window.QEI = Object.assign(window.QEI || {}, { clearSearch: clearSearch })


	function wireForms() {
		document.addEventListener("submit", function (e) {
			const form = e.target;
			if (!form || !form.matches("form")) return;
			if (form.dataset.qeiCorporateWizard === "1") return; // handled by dedicated wizard

			// تجنب نماذج تسجيل الدخول أو النشرة البريدية
			if (form.closest("#modal-login, .modal-box") || /login|تسجيل الدخول/i.test(form.innerHTML)) return;
			if (form.id === "newsletter-form") return;

			// 1. نموذج تواصل معنا / اتصل بنا (Contact Form)
			const isContactForm = form.id === "contact-form" || form.id === "contactForm" || form.classList.contains("contact-form");
			if (isContactForm) {
				e.preventDefault();
				if (!validate(form)) return;
				const formData = values(form);
				const payload = {
					full_name: formData.full_name || formData.name || formData.fullName || Object.values(formData)[0] || "",
					email: formData.email || "",
					subject: formData.subject || "رسالة تواصل من الموقع",
					message: formData.message || formData.notes || Object.values(formData)[Object.values(formData).length - 1] || ""
				};

				if (window.QEIAPI && typeof window.QEIAPI.submitContactMessage === "function") {
					window.QEIAPI.submitContactMessage(payload).then(res => {
						toast(res.message || "تم إرسال رسالتك بنجاح، وسنتواصل معك قريباً!");
						form.reset();
					}).catch(err => {
						toast(err.message || "تعذر إرسال الرسالة، يرجى المحاولة لاحقاً", "error");
					});
				} else {
					toast("تم إرسال رسالتك بنجاح!");
					form.reset();
				}
				return;
			}

			// 2. نموذج طلب برنامج خاص / صمم برنامجك (Corporate / Custom Training Form)
			const isCorporateForm = form.id === "corporate-request-form" || form.classList.contains("custom-request-form");
			if (isCorporateForm) {
				e.preventDefault();
				if (!validate(form)) return;
				const formData = values(form);
				const payload = {
					applicant_name: formData.applicant_name || formData.name || formData.fullName || "",
					company_name: formData.company_name || formData.company || formData.employer || "جهة خاصة/حكومية",
					phone: formData.phone || formData.tel || "",
					email: formData.email || "",
					trainees_count: formData.trainees_count || formData.count || "20-50",
					training_field: formData.training_field || formData.field || "برامج مخصصة",
					need_description: formData.need_description || formData.notes || formData.message || "طلب برنامج تدريبي مخصص",
					preferred_date: formData.preferred_date || null,
					execution_mode: formData.execution_mode || "عن بُعد"
				};

				if (window.QEIAPI && typeof window.QEIAPI.submitCorporateRequest === "function") {
					window.QEIAPI.submitCorporateRequest(payload).then(res => {
						toast(res.message || "تم إرسال طلب البرامج المخصصة بنجاح!");
						setTimeout(() => api.go("registration/request-success.html"), 600);
					}).catch(err => {
						toast(err.message || "تعذر إرسال الطلب، يرجى إعادة المحاولة", "error");
					});
				} else {
					toast("تم إرسال الطلب بنجاح!");
					setTimeout(() => api.go("registration/request-success.html"), 600);
				}
				return;
			}
		});
	}

	function wireCorporateRequestWizard() {
		const form = document.querySelector('form[data-qei-corporate-wizard="1"]');
		if (!form || form.dataset.qeiWizardWired === "1") return;
		form.dataset.qeiWizardWired = "1";

		const panels = Array.from(form.querySelectorAll('[data-corporate-step]'));
		const topSteps = Array.from(document.querySelectorAll('.request-stepper > div'));
		const sideSteps = Array.from(document.querySelectorAll('.request-steps li'));
		const review = form.querySelector('[data-corp-review]');
		const status = form.querySelector('[data-corp-status]');
		const textarea = form.querySelector('textarea[name="need_description"]');
		const counter = form.querySelector('[data-corp-counter]');
		let step = 1;

		// A single corporate request form supports two clear journeys:
		// 1) a new custom training program, 2) a specific corporate solution selected earlier.
		const requestParams = new URLSearchParams(location.search);
		const solutionSlug = String(requestParams.get('solution') || '').trim();
		const solutionTitles = {
			'training-needs': 'تحليل الاحتياج التدريبي',
			'program-design': 'تصميم البرامج التدريبية',
			'training-packages': 'تصميم الحقائب التدريبية',
			'consulting-solutions': 'الاستشارات والحلول المؤسسية',
			'measuring-impact': 'قياس أثر التدريب'
		};
		if (solutionSlug && solutionTitles[solutionSlug]) {
			const solutionTitle = solutionTitles[solutionSlug];
			const typeField = form.elements['request_type'];
			const slugField = form.elements['solution_slug'];
			const titleField = form.elements['solution_title'];
			if (typeField) typeField.value = 'corporate-solution';
			if (slugField) slugField.value = solutionSlug;
			if (titleField) titleField.value = solutionTitle;
			const ctx = document.getElementById('selectedCorporateSolution');
			const ctxTitle = document.getElementById('selectedSolutionTitle');
			if (ctx) ctx.hidden = false;
			if (ctxTitle) ctxTitle.textContent = solutionTitle;
			const pageTitle = document.getElementById('corporateRequestTitle');
			const pageLead = document.getElementById('corporateRequestLead');
			const breadcrumb = document.getElementById('corporateRequestBreadcrumb');
			if (pageTitle) pageTitle.textContent = 'اطلب حلاً مؤسسياً لجهتك';
			if (pageLead) pageLead.textContent = `أكمل بيانات الجهة لبدء طلب «${solutionTitle}» وتحديد نطاق التنفيذ والمخرجات المطلوبة.`;
			if (breadcrumb) breadcrumb.textContent = 'طلب حل مؤسسي';
			const step2Title = document.getElementById('corpStep2Title');
			const step2Help = document.getElementById('corpStep2Help');
			const needDescription = document.getElementById('corpNeedDescription');
			if (step2Title) step2Title.textContent = 'نطاق الحل ومتطلبات الجهة';
			if (step2Help) step2Help.textContent = `أضف تفاصيل النطاق والأهداف المرتبطة بحل «${solutionTitle}» حتى يعد الفريق المقترح المناسب.`;
			if (needDescription) needDescription.placeholder = 'اكتب المشكلة الحالية، الهدف المطلوب، الفئات أو الإدارات المعنية، وأي مخرجات تتوقعها من الحل';
			document.title = `طلب ${solutionTitle} | QEI — معهد خبراء الجودة للتدريب`;
		}

		const fieldValue = (name) => {
			const el = form.elements[name];
			if (!el) return '';
			if (el.type === 'file') return el.files && el.files[0] ? el.files[0].name : '';
			return String(el.value || '').trim();
		};

		const validatePanel = (num, announce = true) => {
			const panel = panels.find(p => Number(p.dataset.corporateStep) === num);
			if (!panel) return true;
			let firstInvalid = null;
			for (const el of Array.from(panel.querySelectorAll('input, select, textarea'))) {
				if (el.type === 'file' && el.files && el.files[0] && el.files[0].size > 10 * 1024 * 1024) {
					el.setCustomValidity('حجم الملف يجب ألا يتجاوز 10MB');
				} else {
					el.setCustomValidity('');
				}
				const valid = el.checkValidity();
				el.classList.toggle('is-invalid', !valid);
				if (!valid && !firstInvalid) firstInvalid = el;
			}
			if (firstInvalid) {
				if (announce) {
					if (typeof firstInvalid.reportValidity === 'function') firstInvalid.reportValidity();
					firstInvalid.focus({ preventScroll: true });
					firstInvalid.scrollIntoView({ behavior: 'smooth', block: 'center' });
					toast('يرجى استكمال الحقول المطلوبة في هذه الخطوة', 'error');
				}
				return false;
			}
			return true;
		};

		const escapeText = (value) => String(value || '—').replace(/[<>]/g, '');
		const renderReview = () => {
			if (!review) return;
			const rows = [
				...(fieldValue('solution_title') ? [['الحل المؤسسي المطلوب', fieldValue('solution_title')]] : []),
				['اسم مقدم الطلب', fieldValue('applicant_name')],
				['اسم الجهة', fieldValue('company_name')],
				['رقم الجوال', fieldValue('phone')],
				['البريد الإلكتروني', fieldValue('email')],
				['عدد المتدربين', fieldValue('trainees_count')],
				['المجال التدريبي', fieldValue('training_field')],
				['نمط التنفيذ', fieldValue('execution_mode')],
				['التاريخ المفضل', fieldValue('preferred_date') || 'مرن / يحدد لاحقاً'],
				['الملف المرفق', fieldValue('attachment') || 'لا يوجد'],
			];
			review.innerHTML = rows.map(([label, value]) => `<div><span>${label}</span><b>${escapeText(value)}</b></div>`).join('') +
				`<div class="corporate-review-note"><span>وصف الاحتياج</span><p>${escapeText(fieldValue('need_description'))}</p></div>`;
		};

		const showStep = (num, scroll = true) => {
			step = Math.max(1, Math.min(3, num));
			panels.forEach(panel => {
				const active = Number(panel.dataset.corporateStep) === step;
				panel.hidden = !active;
				panel.classList.toggle('active', active);
			});
			[topSteps, sideSteps].forEach(group => group.forEach((el, idx) => {
				el.classList.toggle('active', idx + 1 === step);
				el.classList.toggle('done', idx + 1 < step);
			}));
			if (step === 3) renderReview();
			const target = panels.find(p => Number(p.dataset.corporateStep) === step);
			if (scroll && target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
		};

		form.addEventListener('click', (e) => {
			const next = e.target.closest('[data-corp-next]');
			const back = e.target.closest('[data-corp-back]');
			if (next) {
				e.preventDefault();
				if (validatePanel(step)) showStep(step + 1);
				return;
			}
			if (back) {
				e.preventDefault();
				showStep(step - 1);
			}
		});

		form.addEventListener('input', (e) => {
			e.target.classList.remove('is-invalid');
			if (e.target === textarea && counter) counter.textContent = `${textarea.value.length} / 1000`;
		});

		form.addEventListener('submit', async (e) => {
			e.preventDefault();
			e.stopPropagation();
			const valid1 = validatePanel(1, false);
			const valid2 = validatePanel(2, false);
			const valid3 = validatePanel(3, false);
			if (!valid1 || !valid2 || !valid3) {
				const invalidStep = !valid1 ? 1 : (!valid2 ? 2 : 3);
				showStep(invalidStep);
				validatePanel(invalidStep, true);
				return;
			}

			const submitBtn = form.querySelector('.request-submit');
			if (submitBtn) {
				submitBtn.disabled = true;
				submitBtn.dataset.originalText = submitBtn.textContent;
				submitBtn.textContent = 'جارٍ إرسال الطلب...';
			}
			if (status) {
				status.textContent = 'يتم الآن إرسال الطلب وحفظه...';
				status.className = 'request-submit-status loading';
			}

			const fd = new FormData(form);
			fd.delete('privacy_consent');
			let phone = String(fd.get('phone') || '').replace(/\s+/g, '');
			if (/^05\d{8}$/.test(phone)) phone = '+966' + phone.slice(1);
			else if (/^5\d{8}$/.test(phone)) phone = '+966' + phone;
			fd.set('phone', phone);

			try {
				if (!window.QEIAPI || typeof window.QEIAPI.submitCorporateRequest !== 'function') {
					throw new Error('خدمة استقبال الطلبات غير متاحة حالياً');
				}
				const res = await window.QEIAPI.submitCorporateRequest(fd);
				const id = res && res.data ? res.data.id : null;
				const requestNumber = id ? `QEI-CORP-${new Date().getFullYear()}-${String(id).padStart(5, '0')}` : `QEI-CORP-${new Date().getFullYear()}`;
				const saved = {};
				for (const [key, value] of fd.entries()) if (!(value instanceof File)) saved[key] = value;
				saved.request_id = id;
				saved.request_number = requestNumber;
				saved.submitted_at = new Date().toISOString();
				try { sessionStorage.setItem('qei_corporate_request', JSON.stringify(saved)); } catch (err) { }
				if (status) {
					status.textContent = 'تم استلام الطلب بنجاح. جارٍ فتح صفحة التأكيد...';
					status.className = 'request-submit-status success';
				}
				toast(res.message || 'تم إرسال طلبك بنجاح');
				setTimeout(() => api.go(`registration/request-success.html${id ? '?request_id=' + encodeURIComponent(id) : ''}`), 350);
			} catch (err) {
				if (status) {
					status.textContent = err.message || 'تعذر إرسال الطلب. يرجى المحاولة مرة أخرى.';
					status.className = 'request-submit-status error';
				}
				toast(err.message || 'تعذر إرسال الطلب، يرجى إعادة المحاولة', 'error');
				if (submitBtn) {
					submitBtn.disabled = false;
					submitBtn.textContent = submitBtn.dataset.originalText || 'إرسال الطلب';
				}
			}
		});

		showStep(1, false);
	}

	function wireCorporateRequestSuccess() {
		if (!document.body || document.body.dataset.page !== 'request-success') return;
		let saved = {};
		try { saved = JSON.parse(sessionStorage.getItem('qei_corporate_request') || '{}') || {}; } catch (e) { }
		const params = new URLSearchParams(location.search);
		const id = params.get('request_id') || saved.request_id;
		const requestNumber = saved.request_number || (id ? `QEI-CORP-${new Date().getFullYear()}-${String(id).padStart(5, '0')}` : 'QEI-CORP');
		const numberEl = document.querySelector('.rqs-hero strong');
		if (numberEl) numberEl.textContent = requestNumber;
		const dds = Array.from(document.querySelectorAll('.rqs-summary dd'));
		if (dds[0] && saved.company_name) dds[0].textContent = saved.company_name;
		if (dds[1]) dds[1].textContent = saved.solution_title || (saved.request_type === 'corporate-solution' ? 'حل مؤسسي' : 'برنامج تدريبي مؤسسي');
		if (dds[2]) dds[2].textContent = saved.training_field || 'يحدد بعد مراجعة الاحتياج';
		if (dds[3]) dds[3].textContent = saved.trainees_count || 'يحدد مع مستشار المعهد';
	}

	function getLogoPath() {
		const isSubDir = /\/(programs|news|solutions|about|policies|registration|gallery|support|docs|tools)\//i.test(location.pathname) || (location.pathname.split('/').filter(Boolean).length > 1 && !/index\.html$/i.test(location.pathname));
		return (isSubDir ? "../" : "") + "assets/images/brand/qei-logo.png";
	}

	function showSkeleton(container) {
		if (!container) return;
		if (container.dataset.qeiLoading === "1") return;
		// If the HTML already contains real fallback cards/content, keep them visible.
		// Live API data may replace them later; a loading mark must never hide usable content.
		const meaningfulChildren = Array.from(container.children || []).filter(el =>
			!el.classList.contains('qei-skeleton-card') && !el.classList.contains('qei-logo-sibling-loader')
		);
		if (meaningfulChildren.length > 0 && container.dataset.qeiForceLoader !== '1') return;

		const logoPath = getLogoPath();

		if (!document.getElementById("qei-logo-pulse-style")) {
			const style = document.createElement("style");
			style.id = "qei-logo-pulse-style";
			style.textContent = `
				@keyframes qei-logo-pulse {
					0%, 100% { opacity: 0.65; transform: scale(0.92); }
					50% { opacity: 1; transform: scale(1.08); }
				}
				.qei-logo-sibling-loader {
					grid-column: 1 / -1 !important;
					flex: 1 1 100% !important;
					width: 100% !important;
					display: flex !important;
					align-items: center !important;
					justify-content: center !important;
					min-height: 220px !important;
					padding: 2.5rem 0 !important;
					margin: 0 auto !important;
					text-align: center !important;
					box-sizing: border-box !important;
					clear: both !important;
				}
				.qei-logo-sibling-loader img {
					margin: 0 auto !important;
					display: block !important;
					width: 76px !important;
					height: 76px !important;
					object-fit: contain !important;
					animation: qei-logo-pulse 1.4s ease-in-out infinite !important;
				}
			`;
			document.head.appendChild(style);
		}

		container.dataset.qeiLoading = "1";
		container.dataset.qeiOrigDisplay = container.style.display || "";
		container.style.display = "none";

		const loader = document.createElement("div");
		loader.className = "qei-logo-sibling-loader";
		loader.setAttribute("data-for", container.id || "");
		loader.innerHTML = `
			<img src="${logoPath}" alt="QEI" />
		`;

		if (container.parentElement) {
			container.parentElement.insertBefore(loader, container.nextSibling);
		}
	}

	function restoreSkeleton(container) {
		if (!container) return;
		container.style.display = container.dataset.qeiOrigDisplay || "";
		delete container.dataset.qeiLoading;
		delete container.dataset.qeiOrigDisplay;
		const loader = container.parentElement
			? container.parentElement.querySelector(".qei-logo-sibling-loader")
			: null;
		if (loader) loader.remove();
	}

	window.showSkeleton = showSkeleton;
	window.restoreSkeleton = restoreSkeleton;

	function setupDynamicPagination(grid, navSelector = "[class*='pagination'], [class*='pager']", pageSize = 15) {
		if (!grid) return;
		let nav = typeof navSelector === "string" ? ($(navSelector, grid.parentElement) || $(navSelector)) : navSelector;
		if (!nav) {
			nav = document.createElement("nav");
			nav.className = "pl-pagination";
			if (grid.parentElement) grid.parentElement.appendChild(nav);
		}

		let currentPage = 1;

		function renderPage(p) {
			const cards = Array.from(grid.children).filter(c => !c.classList.contains("qei-skeleton-card"));
			const visibleCards = cards.filter(c => !c.hidden);
			const totalItems = visibleCards.length;
			const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
			currentPage = Math.min(Math.max(1, p), totalPages);

			visibleCards.forEach((c, idx) => {
				const show = idx >= (currentPage - 1) * pageSize && idx < currentPage * pageSize;
				if (show) {
					c.style.removeProperty("display");
					c.style.display = "";
				} else {
					c.style.setProperty("display", "none", "important");
				}
			});

			nav.innerHTML = "";
			if (totalPages <= 1) return;

			// زر السابق
			const prevBtn = document.createElement("a");
			prevBtn.className = `page-btn prev ${currentPage === 1 ? "disabled" : ""}`;
			prevBtn.textContent = "السابق";
			prevBtn.href = "javascript:void(0)";
			prevBtn.onclick = (e) => {
				e.preventDefault();
				if (currentPage > 1) {
					renderPage(currentPage - 1);
					grid.scrollIntoView({ block: "start", behavior: "smooth" });
				}
			};
			nav.appendChild(prevBtn);

			// إيجاد قائمة الأرقام المطلوبة (يدعم أعداد لامحدودة بدون ازدحام)
			let pagesToShow = [];
			if (totalPages <= 7) {
				for (let i = 1; i <= totalPages; i++) pagesToShow.push(i);
			} else {
				if (currentPage <= 4) {
					pagesToShow = [1, 2, 3, 4, 5, "...", totalPages];
				} else if (currentPage >= totalPages - 3) {
					pagesToShow = [1, "...", totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
				} else {
					pagesToShow = [1, "...", currentPage - 1, currentPage, currentPage + 1, "...", totalPages];
				}
			}

			// رسم أزرار الصفحات
			pagesToShow.forEach(item => {
				if (item === "...") {
					const dots = document.createElement("span");
					dots.className = "page-dots";
					dots.textContent = "...";
					dots.style.padding = "0 0.25rem";
					dots.style.color = "#64748b";
					nav.appendChild(dots);
				} else {
					const pageBtn = document.createElement("a");
					pageBtn.className = `page-btn ${item === currentPage ? "active" : ""}`;
					pageBtn.textContent = String(item);
					pageBtn.href = "javascript:void(0)";
					pageBtn.onclick = (e) => {
						e.preventDefault();
						renderPage(item);
						grid.scrollIntoView({ block: "start", behavior: "smooth" });
					};
					nav.appendChild(pageBtn);
				}
			});

			// زر التالي
			const nextBtn = document.createElement("a");
			nextBtn.className = `page-btn next ${currentPage === totalPages ? "disabled" : ""}`;
			nextBtn.textContent = "التالي";
			nextBtn.href = "javascript:void(0)";
			nextBtn.onclick = (e) => {
				e.preventDefault();
				if (currentPage < totalPages) {
					renderPage(currentPage + 1);
					grid.scrollIntoView({ block: "start", behavior: "smooth" });
				}
			};
			nav.appendChild(nextBtn);
		}

		renderPage(1);
	}

	function ensureAPI(fn) {
		if (window.QEIAPI) {
			fn();
		} else {
			let attempts = 0;
			const interval = setInterval(() => {
				attempts++;
				if (window.QEIAPI) {
					clearInterval(interval);
					fn();
				} else if (attempts > 40) {
					clearInterval(interval);
				}
			}, 50);
		}
	}

	function wireProgramsListingLegacyRendererDisabled() {
		if (!/programs\.html/.test(location.pathname)) return;

		const gridEarly = $(".programs-grid") || $(".pl-grid") || $(".cards-grid");
		if (gridEarly) showSkeleton(gridEarly);

		ensureAPI(() => {
			const grid = $(".programs-grid") || $(".pl-grid") || $(".cards-grid");
			if (!grid) return;

			window.QEIAPI.getPrograms().then(res => {
				if (!res || !res.data || !res.data.length) {
					restoreSkeleton(grid);
					return;
				}
				restoreSkeleton(grid);
				grid.innerHTML = "";
				res.data.forEach(p => {
					const card = document.createElement("article");
					card.className = "program-card pl-card card";
					card.style.cssText = "height: auto !important; min-height: 430px; display: flex; flex-direction: column; justify-content: space-between; padding: 16px; border-radius: 14px; border: 1px solid #e2e8f0; background: #ffffff; box-shadow: 0 4px 12px rgba(0,0,0,0.03);";
					const pImg = p.image ? url(p.image) : (p.image_url || url('assets/images/programs/course-placeholder.jpg'));
					card.innerHTML = `
						<div class="card-image-wrap" style="position: relative; height: 180px; width: 100%; border-radius: 10px; overflow: hidden; background: #f8fafc;">
							<img src="${pImg}" alt="${p.title}" style="width: 100%; height: 100%; object-fit: cover; display: block;" loading="lazy" fetchpriority="low" />
							<span class="card-tag" style="position: absolute; top: 10px; right: 10px; background: rgba(12, 56, 102, 0.88); color: #fff; padding: 4px 12px; border-radius: 20px; font-size: 11px; font-weight: 700; backdrop-filter: blur(4px);">${p.level || 'جميع المستويات'}</span>
						</div>
						<div class="card-content" style="padding-top: 14px; display: flex; flex-direction: column; flex: 1;">
							<h3 class="card-title" style="font-size: 1.05rem; font-weight: 800; color: #0f172a; margin: 0 0 12px 0; line-height: 1.4;">${p.title}</h3>
							<div class="card-meta" style="font-size: 0.82rem; color: #0284c7; font-weight: 600; margin-bottom: 14px; display: flex; align-items: center; gap: 6px;">
								<span>⏱️ ${p.duration_days || 5} أيام (${p.duration_hours || 25} ساعة)</span>
							</div>
							<div class="card-footer" style="display: flex; gap: 10px; margin-top: auto; padding-top: 12px; border-top: 1px solid #f1f5f9;">
								<a href="../registration/registration-personal.html?program=${p.id}" class="btn btn-primary" style="flex: 1; width: 100%; text-align: center; padding: 10px 14px; background: #0c3866; border-radius: 8px; color: #ffffff; font-weight: 700; font-size: 0.9rem; text-decoration: none;">سجّل الآن</a>
							</div>
							<span style="display:none;" class="hidden-filter-terms">${p.category ? p.category.name : ''} حضوري عن بُعد</span>
						</div>
					`;
					grid.appendChild(card);
				});
				const countBadge = $("#programCountBadge");
				if (countBadge) countBadge.textContent = `${res.data.length} برنامجًا تدريبيًا`;
				setupDynamicPagination(grid, ".pl-pagination", 15);
			}).catch(err => {
				console.warn("[QEINST API] Programs load error:", err);
				restoreSkeleton(grid);
			});
		});
	}

	function wireProgramDetailsLegacyDisabled2() {
		if (!/program-details\.html/.test(location.pathname)) return;
		ensureAPI(() => {
			const params = new URLSearchParams(location.search);
			const slug = params.get("slug") || params.get("id");
			if (!slug) return;
			window.QEIAPI.getProgramBySlug(slug).then(res => {
				if (!res || !res.data) return;
				const p = res.data;
				const titleEl = $("h1") || $(".program-title") || $(".pd-title");
				if (titleEl && p.title) titleEl.textContent = p.title;
				const descEl = $(".pd-desc") || $(".program-description");
				if (descEl && p.description) descEl.innerHTML = p.description;
				const imgEl = $(".pd-hero-img") || $(".program-img");
				if (imgEl && (p.image || p.image_url)) imgEl.src = p.image ? url(p.image) : p.image_url;
			}).catch(err => console.warn("[QEINST API] Program details load error:", err));
		});
	}

	function wireClientsListing() {
		if (!/clients\.html/.test(location.pathname)) return;

		const partnerGridEarly = $("#partnerGrid") || $(".partner-grid") || $(".clients-grid");
		if (partnerGridEarly) showSkeleton(partnerGridEarly);
		const successGridEarly = $(".success-grid");
		if (successGridEarly) showSkeleton(successGridEarly);

		ensureAPI(() => {
			// 1. شبكة العملاء والشركاء (Logos)
			const partnerGrid = $("#partnerGrid") || $(".partner-grid") || $(".clients-grid");
			if (partnerGrid) {
				window.QEIAPI.getClients().then(res => {
					if (!res || !res.data || !res.data.length) {
						restoreSkeleton(partnerGrid);
						return;
					}
					restoreSkeleton(partnerGrid);
					partnerGrid.innerHTML = "";
					res.data.forEach(client => {
						const article = document.createElement("article");
						article.dataset.category = client.type || "عام";
						article.className = "partner-card-item";

						const rawLogo = client.logo || client.logo_url || 'assets/images/clients/images.png';
						const logoSrc = /^https?:\/\//.test(rawLogo) ? rawLogo : ROOT + String(rawLogo).replace(/^\/+/, '');

						article.innerHTML = `
							<img class="partner-logo-img" src="${logoSrc}" alt="${client.name}" title="${client.name}" loading="lazy" fetchpriority="low" />
						`;
						partnerGrid.appendChild(article);
					});
				}).catch(err => {
					console.warn("[QEINST API] Clients load error:", err);
					restoreSkeleton(partnerGrid);
				});
			}

			// 2. قسم "قصص نجاح من شراكاتنا" (Success Stories)
			const successGrid = $(".success-grid");
			if (successGrid) {
				window.QEIAPI.getSuccessStories().then(res => {
					if (!res || !res.data || !res.data.length) {
						restoreSkeleton(successGrid);
						return;
					}
					restoreSkeleton(successGrid);
					successGrid.innerHTML = "";
					res.data.forEach(story => {
						const article = document.createElement("article");
						article.className = "success-story-card";
						article.innerHTML = `
							<div class="success-media teal" style="position:relative; height:160px; overflow:hidden;">
								<img src="${ROOT}${story.image || 'assets/images/gallery/gallery-list-1.jpg'}" alt="${story.title}" loading="lazy" style="width:100%; height:100%; object-fit:cover; display:block;" />
								${story.stat_number ? `<span style="position:absolute; bottom:10px; right:10px; background:rgba(12, 56, 102, 0.9); color:#fff; padding:4px 12px; border-radius:12px; font-weight:800; font-size:0.85rem;">${story.stat_number} ${story.stat_label || ''}</span>` : ''}
							</div>
							<div class="success-copy" style="padding:1.25rem;">
								<h3 style="font-size:1.15rem; margin-bottom:0.5rem; font-weight:700;">${story.title}</h3>
								<p style="color:#475569; font-size:0.95rem; line-height:1.6;">${story.quote_or_description || ''}</p>
								<footer style="margin-top:1rem; display:flex; justify-content:space-between; align-items:center; border-top:1px solid #f1f5f9; padding-top:0.75rem;">
									<span style="font-size:0.85rem; color:#0284c7; font-weight:600;">${story.client_name || story.position_or_company || 'شراكة استراتيجية'}</span>
								</footer>
							</div>
						`;
						successGrid.appendChild(article);
					});
				}).catch(err => {
					console.warn("[QEINST API] Success Stories load error:", err);
					restoreSkeleton(successGrid);
				});
			}
		});
	}

	function wireCalendarListing() {
		if (!/calendar\.html/.test(location.pathname)) return;

		const containerEarly = $("#calendarProgramsList");
		if (containerEarly) showSkeleton(containerEarly);

		ensureAPI(() => {
			const container = $("#calendarProgramsList");
			if (!container) return;

			// Populate Categories filter dropdown dynamically
			const catSelect = $("select[aria-label='المجال']") || $("select[data-filter='المجال']");
			if (catSelect) {
				window.QEIAPI.getCategories().then(res => {
					if (res && res.data && res.data.length) {
						catSelect.innerHTML = `<option value="">المجال — جميع المجالات</option>`;
						res.data.forEach(c => {
							catSelect.innerHTML += `<option value="${c.name}">${c.name}</option>`;
						});
					}
				});
			}

			window.QEIAPI.getPrograms().then(res => {
				if (!res || !res.data || !res.data.length) {
					restoreSkeleton(container);
					return;
				}
				restoreSkeleton(container);
				const programs = res.data;

				// Collect all schedules for monthly grid mapping
				const allSchedulesList = [];
				programs.forEach(p => {
					if (p.schedules && p.schedules.length) {
						p.schedules.forEach(s => allSchedulesList.push({ program: p, schedule: s }));
					}
				});

				// Dynamic Location Dropdown
				const locSelect = $("select[aria-label='الموقع']") || $("select[data-filter='الموقع']");
				if (locSelect) {
					const locs = Array.from(new Set(allSchedulesList.map(item => {
						const loc = item.schedule.location || '';
						return loc.includes('-') ? loc.split('-')[0].trim() : loc.trim();
					}).filter(Boolean)));

					locSelect.innerHTML = `<option value="">الموقع — جميع المواقع</option>`;
					locs.forEach(loc => {
						locSelect.innerHTML += `<option value="${loc}">${loc}</option>`;
					});
				}

				// Dynamic Execution Mode Dropdown
				const modeSelect = $("select[aria-label='طريقة التنفيذ']") || $("select[data-filter='طريقة التنفيذ']");
				if (modeSelect) {
					const modes = Array.from(new Set(allSchedulesList.map(item => item.schedule.execution_mode).filter(Boolean)));
					modeSelect.innerHTML = `<option value="">طريقة التنفيذ — الكل</option>`;
					modes.forEach(m => {
						modeSelect.innerHTML += `<option value="${m}">${m}</option>`;
					});
				}

				// Dynamic Monthly Grid Builder
				function renderCalendarGrid(year = 2026, month = 8, filterCat = "", filterLoc = "", filterMode = "") {
					const daysContainer = $(".tc-days");
					if (!daysContainer) return;
					daysContainer.innerHTML = "";

					const firstDay = new Date(year, month - 1, 1);
					const totalDaysInMonth = new Date(year, month, 0).getDate();

					const jsDay = firstDay.getDay();
					const startOffset = (jsDay === 6) ? 0 : (jsDay + 1);

					// Previous month days fill
					const prevMonthTotalDays = new Date(year, month - 1, 0).getDate();
					for (let i = startOffset - 1; i >= 0; i--) {
						const dayNum = prevMonthTotalDays - i;
						const cell = document.createElement("div");
						cell.className = "tc-day muted";
						cell.innerHTML = `<b>${dayNum}</b>`;
						daysContainer.appendChild(cell);
					}

					// Filter schedules list based on selected dropdowns
					const filteredList = allSchedulesList.filter(item => {
						const catName = item.program.category ? item.program.category.name : '';
						if (filterCat && catName !== filterCat && !norm(catName).includes(norm(filterCat))) return false;
						if (filterLoc && !norm(item.schedule.location || '').includes(norm(filterLoc))) return false;
						if (filterMode && !norm(item.schedule.execution_mode || '').includes(norm(filterMode))) return false;
						return true;
					});

					// Create map of schedules per day number
					const scheduleMap = {};
					filteredList.forEach(item => {
						if (!item.schedule || !item.schedule.start_date) return;
						const sDate = new Date(item.schedule.start_date);
						if (sDate.getFullYear() === year && (sDate.getMonth() + 1) === month) {
							const day = sDate.getDate();
							if (!scheduleMap[day]) scheduleMap[day] = [];
							scheduleMap[day].push(item);
						}
					});

					// Current month days
					for (let d = 1; d <= totalDaysInMonth; d++) {
						const cell = document.createElement("div");
						cell.className = "tc-day";
						let html = `<b>${d}</b>`;

						const itemsForDay = scheduleMap[d];
						if (itemsForDay && itemsForDay.length) {
							const first = itemsForDay[0];
							const s = first.schedule;
							let tagClass = "open";
							let tagText = "متاح";

							if (s.status === "مكتمل" || s.available_seats === 0) {
								tagClass = "full";
								tagText = "مكتمل";
							} else if (s.available_seats <= 5 || s.status === "مقاعد محدودة") {
								tagClass = "limited";
								tagText = "محدودة";
							}

							const locShort = s.location ? (s.location.includes('-') ? s.location.split('-')[0].trim() : s.location) : 'الرياض';
							html += `
								<div class="tc-tag ${tagClass}" title="${first.program.title} | ${s.location}">
									<span style="font-size:0.75rem; font-weight:800; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">📍 ${locShort}</span>
									<span style="font-size:0.65rem; opacity:0.9; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">● ${tagText}</span>
								</div>
							`;
						}

						cell.innerHTML = html;
						if (itemsForDay) {
							cell.style.cursor = "pointer";
							cell.onclick = () => {
								$$(".tc-day").forEach(c => c.style.outline = "");
								cell.style.outline = "2px solid #0284c7";
								renderCalendarItems(filterCat, filterLoc, filterMode, d);
							};
						}
						daysContainer.appendChild(cell);
					}

					// Fill remaining cells
					const totalCells = daysContainer.children.length;
					const targetCells = totalCells > 35 ? 42 : 35;
					const remaining = targetCells - totalCells;
					for (let r = 1; r <= remaining; r++) {
						const cell = document.createElement("div");
						cell.className = "tc-day muted";
						cell.innerHTML = `<b>${r}</b>`;
						daysContainer.appendChild(cell);
					}
				}

				renderCalendarGrid(2026, 8);

				function renderCalendarItems(filterCat = "", filterLoc = "", filterMode = "", filterDay = null) {
					container.innerHTML = "";
					programs.forEach(p => {
						const catName = p.category ? p.category.name : '';
						if (filterCat && catName !== filterCat && !norm(catName).includes(norm(filterCat))) return;

						const schedules = p.schedules && p.schedules.length ? p.schedules : [{
							id: p.id,
							start_date: '2026-08-10',
							end_date: '2026-08-14',
							location: 'الرياض - فندق الفورسيزونز',
							execution_mode: 'حضوري',
							price: p.price || 2500,
							available_seats: 12,
							status: 'متاح للتسجيل'
						}];

						schedules.forEach(s => {
							if (filterLoc && !norm(s.location || '').includes(norm(filterLoc))) return;
							if (filterMode && !norm(s.execution_mode || '').includes(norm(filterMode))) return;

							if (filterDay) {
								const sDate = new Date(s.start_date);
								if (sDate.getDate() !== filterDay) return;
							}

							// Status badge logic
							let badgeBg = "#e6f7ee";
							let badgeColor = "#28a467";
							let badgeText = "متاح";

							if (s.status === "مكتمل" || s.available_seats === 0) {
								badgeBg = "#fde9e9";
								badgeColor = "#dd6565";
								badgeText = "مكتمل";
							} else if (s.available_seats <= 5 || s.status === "مقاعد محدودة") {
								badgeBg = "#fff3df";
								badgeColor = "#e7a13c";
								badgeText = "مقاعد محدودة";
							}

							const cleanStart = s.start_date ? String(s.start_date).split('T')[0] : '';
							const cleanEnd = s.end_date ? String(s.end_date).split('T')[0] : '';
							const dateRange = cleanStart && cleanEnd ? `${cleanStart} - ${cleanEnd}` : (cleanStart || 'موعد متاح');
							const imgPath = p.image ? (p.image.startsWith('http') || p.image.startsWith('/') || p.image.startsWith('assets') ? (p.image.startsWith('assets') ? '../' + p.image : p.image) : '../' + p.image) : '../assets/images/programs/courses/course-001.webp';

							const card = document.createElement("article");
							card.className = "tc-program-card";
							card.style.cssText = "display:flex; align-items:center; justify-content:space-between; background:#ffffff; padding:1.25rem 1.5rem; border-radius:14px; border:1px solid #f1f5f9; margin-bottom:1rem; gap:1.25rem; box-shadow:0 2px 10px rgba(0,0,0,0.02); flex-wrap:wrap;";

							card.innerHTML = `
								<!-- Right side: Image thumbnail -->
								<div style="width:140px; height:90px; border-radius:12px; overflow:hidden; background:#f8fafc; border:1px solid #e2e8f0; flex-shrink:0;">
									<img src="${imgPath}" alt="${p.title}" style="width:100%; height:100%; object-fit:cover;" loading="lazy" fetchpriority="low" />
								</div>

								<!-- Program Title + Status Badge -->
								<div style="display:flex; align-items:center; gap:0.75rem; flex:1.2; min-width:260px; justify-content:flex-start;">
									<h3 style="font-size:1.1rem; font-weight:800; color:#0f172a; margin:0; line-height:1.4; text-align:right;">${p.title}</h3>
									<span style="background:${badgeBg}; color:${badgeColor}; font-weight:700; padding:4px 14px; border-radius:20px; font-size:0.78rem; white-space:nowrap;">${badgeText}</span>
								</div>

								<!-- Middle Meta: Date, Location, Duration -->
								<div style="text-align:center; flex:1; min-width:190px; color:#94a3b8; font-size:0.85rem; line-height:1.6;">
									<div style="font-weight:600; color:#64748b; font-size:0.85rem;">${dateRange}</div>
									<div style="font-size:0.82rem; color:#94a3b8; margin:2px 0;">${s.location || 'الرياض - المملكة العربية السعودية'}</div>
									<div style="font-size:0.8rem; color:#cbd5e1;">معهد خبراء الجودة · ${p.duration_days || 5} أيام</div>
								</div>

								<!-- Left side: Buttons -->
								<div style="display:flex; align-items:center; gap:0.75rem; margin-right:auto;">
									<a href="../registration/registration-personal.html?program=${p.id}" class="btn" style="background:#0c3866; color:#ffffff; padding:0.65rem 1.6rem; border-radius:10px; font-weight:700; font-size:0.9rem; text-decoration:none; box-shadow:0 4px 10px rgba(12,56,102,0.18);">التسجيل</a>
									<a href="program-details.html?slug=${p.slug || p.id}" class="btn" style="background:#ffffff; border:1px solid #cbd5e1; color:#475569; padding:0.65rem 1.25rem; border-radius:10px; font-weight:700; font-size:0.9rem; text-decoration:none;">التفاصيل</a>
								</div>
							`;
							container.appendChild(card);
						});
					});

					setupDynamicPagination(container, "[class*='pagination'], .pl-pagination", 4);
				}

				renderCalendarItems();

				// Wire select filter events (Filter both Grid and List dynamically)
				$$("select", $(".tc-filters")).forEach(sel => {
					sel.addEventListener("change", () => {
						const catVal = (catSelect ? catSelect.value : "");
						const locVal = (locSelect ? locSelect.value : "");
						const modeVal = (modeSelect ? modeSelect.value : "");
						renderCalendarGrid(2026, 8, catVal, locVal, modeVal);
						renderCalendarItems(catVal, locVal, modeVal);
					});
				});

				// Reset button
				const resetBtn = $("button", $(".tc-filters"));
				if (resetBtn) {
					resetBtn.addEventListener("click", (e) => {
						e.preventDefault();
						$$("select", $(".tc-filters")).forEach(s => s.selectedIndex = 0);
						renderCalendarGrid(2026, 8);
						renderCalendarItems();
					});
				}
			}).catch(err => console.warn("[QEINST API] Calendar programs load error:", err));
		});
	}

	function wireInteractiveCalendar() {
		if (!/calendar\.html/.test(location.pathname)) return;

		const calendar = $("#trainingCalendar") || $(".tc-calendar");
		const daysEl = $("#calendarDays") || $(".tc-days");
		const weekHeader = $("#calendarWeekHeader") || $(".tc-week");
		const listEl = $("#calendarProgramsList");
		const periodTitle = $("#calendarPeriodTitle");
		const upcomingTitle = $("#calendarUpcomingTitle");
		const selectionBar = $("#calendarSelectionBar");
		const selectionText = $("#calendarSelectionText");
		const clearDayBtn = $("#calendarClearDay");
		if (!calendar || !daysEl || !listEl) return;

		const filtersBox = $(".tc-filters");
		const catSelect = $("select[aria-label='المجال']") || $("select[data-filter='المجال']");
		const locSelect = $("select[aria-label='الموقع']") || $("select[data-filter='الموقع']");
		const modeSelect = $("select[aria-label='طريقة التنفيذ']") || $("select[data-filter='طريقة التنفيذ']");
		const resetBtn = filtersBox ? $("button", filtersBox) : null;
		const todayBtn = $("#calendarTodayBtn");
		const prevBtn = $("#calendarPrevBtn");
		const nextBtn = $("#calendarNextBtn");

		const pad = n => String(n).padStart(2, '0');
		const dateKey = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
		const parseDate = value => {
			if (!value) return null;
			const clean = String(value).split('T')[0];
			const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(clean);
			if (!m) return null;
			return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0, 0);
		};
		const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
		const sameDay = (a, b) => a && b && dateKey(a) === dateKey(b);
		const esc = v => escapeHtml(String(v == null ? '' : v));
		const monthFmt = new Intl.DateTimeFormat('ar-SA-u-ca-gregory', { month: 'long', year: 'numeric' });
		const fullDateFmt = new Intl.DateTimeFormat('ar-SA-u-ca-gregory', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
		const shortDateFmt = new Intl.DateTimeFormat('ar-SA-u-ca-gregory', { day: 'numeric', month: 'short', year: 'numeric' });

		const state = {
			cursor: new Date(),
			selectedDay: null,
			programs: [],
			items: [],
		};

		function imagePath(raw) {
			if (!raw) return '../assets/images/programs/courses/course-001.webp';
			let value = String(raw).trim();
			try {
				if (/^https?:\/\//i.test(value)) {
					const u = new URL(value);
					const marker = '/assets/';
					const idx = u.pathname.indexOf(marker);
					if (idx >= 0) value = u.pathname.slice(idx + 1);
					else return value;
				}
			} catch (_) { }
			value = value.replace(/^\/+/, '');
			return value.startsWith('assets/') ? '../' + value : (value.startsWith('../') ? value : '../' + value);
		}

		function statusMeta(s) {
			const seats = Number(s.available_seats);
			const raw = norm(s.status || '');
			if (raw.includes('مكتمل') || seats === 0) return { cls: 'full', text: 'مكتمل' };
			if (raw.includes('محدود') || (Number.isFinite(seats) && seats > 0 && seats <= 5)) return { cls: 'limited', text: 'مقاعد محدودة' };
			return { cls: 'open', text: 'متاح' };
		}

		function normalizedLocation(s) { return String(s.location || '').trim(); }

		function filters() {
			return {
				cat: catSelect ? catSelect.value : '',
				loc: locSelect ? locSelect.value : '',
				mode: modeSelect ? modeSelect.value : '',
			};
		}

		function filteredItems() {
			const f = filters();
			return state.items.filter(item => {
				const catName = item.program.category ? item.program.category.name : '';
				if (f.cat && !norm(catName).includes(norm(f.cat))) return false;
				if (f.loc && !norm(normalizedLocation(item.schedule)).includes(norm(f.loc))) return false;
				if (f.mode && !norm(item.schedule.execution_mode || '').includes(norm(f.mode))) return false;
				return true;
			});
		}

		function monthItems() {
			const y = state.cursor.getFullYear(), m = state.cursor.getMonth();
			return filteredItems().filter(item => item.date && item.date.getFullYear() === y && item.date.getMonth() === m)
				.sort((a, b) => a.date - b.date || String(a.program.title).localeCompare(String(b.program.title), 'ar'));
		}

		function updateTitle() {
			if (periodTitle) periodTitle.textContent = monthFmt.format(state.cursor);
		}

		function renderEventChip(item) {
			const meta = statusMeta(item.schedule);
			const title = esc(item.program.title);
			const mode = esc(item.schedule.execution_mode || '');
			return `<a class="tc-event-chip ${meta.cls}" href="program-details.html?slug=${encodeURIComponent(item.program.slug || item.program.id)}" title="${title}"><strong>${title}</strong>${mode ? `<small>${mode}</small>` : ''}</a>`;
		}

		function renderMonth() {
			updateTitle();
			if (weekHeader) weekHeader.hidden = false;
			calendar.className = 'tc-calendar tc-view-month';
			daysEl.className = 'tc-days tc-month-grid';
			daysEl.innerHTML = '';
			const y = state.cursor.getFullYear(), m = state.cursor.getMonth();
			const first = new Date(y, m, 1, 12);
			const offset = (first.getDay() + 1) % 7; // Saturday first
			const gridStart = addDays(first, -offset);
			const byDay = new Map();
			for (const item of filteredItems()) {
				const key = dateKey(item.date);
				if (!byDay.has(key)) byDay.set(key, []);
				byDay.get(key).push(item);
			}
			const today = new Date();
			for (let i = 0; i < 42; i++) {
				const d = addDays(gridStart, i), key = dateKey(d), items = byDay.get(key) || [];
				const cell = document.createElement('div');
				cell.className = 'tc-day' + (d.getMonth() !== m ? ' muted' : '') + (sameDay(d, today) ? ' tc-today' : '') + (state.selectedDay === key ? ' tc-selected-day' : '');
				cell.dataset.date = key;
				const shown = items.slice(0, 2).map(renderEventChip).join('');
				const more = items.length > 2 ? `<button type="button" class="tc-more-events" data-date="${key}">+${items.length - 2} برامج</button>` : '';
				cell.innerHTML = `<button type="button" class="tc-day-number" data-date="${key}" aria-label="${esc(fullDateFmt.format(d))}">${d.getDate()}</button><div class="tc-day-events">${shown}${more}</div>`;
				daysEl.appendChild(cell);
			}
		}

		function renderProgramCard(item) {
			const p = item.program, s = item.schedule, meta = statusMeta(s);
			const cleanStart = parseDate(s.start_date), cleanEnd = parseDate(s.end_date);
			const dateText = cleanStart ? (cleanEnd && !sameDay(cleanStart, cleanEnd) ? `${shortDateFmt.format(cleanStart)} — ${shortDateFmt.format(cleanEnd)}` : fullDateFmt.format(cleanStart)) : 'موعد متاح';
			const pImg = p.image ? imagePath(p.image) : (p.image_url || '../assets/images/programs/course-placeholder.jpg');
			return `<article class="program-card pl-card card" style="height: auto !important; min-height: 430px; display: flex; flex-direction: column; justify-content: space-between; padding: 16px; border-radius: 14px; border: 1px solid #e2e8f0; background: #ffffff; box-shadow: 0 4px 12px rgba(0,0,0,0.03);">
						<a href="program-details.html?slug=${encodeURIComponent(p.slug || p.id)}" class="card-image-wrap" style="position: relative; height: 180px; width: 100%; border-radius: 10px; overflow: hidden; background: #f8fafc; display: block;">
							<img src="${esc(pImg)}" alt="${esc(p.title)}" style="width: 100%; height: 100%; object-fit: cover; display: block;" loading="lazy" fetchpriority="low" onerror="this.onerror=null;this.src='../assets/images/programs/courses/course-001.webp'" />
							<span class="card-tag" style="position: absolute; top: 10px; right: 10px; background: rgba(12, 56, 102, 0.88); color: #fff; padding: 4px 12px; border-radius: 20px; font-size: 11px; font-weight: 700; backdrop-filter: blur(4px);">${p.level || 'جميع المستويات'}</span>
						</a>
						<div class="card-content" style="padding-top: 14px; display: flex; flex-direction: column; flex: 1;">
							<h3 class="card-title" style="font-size: 1.05rem; font-weight: 800; color: #0f172a; margin: 0 0 12px 0; line-height: 1.4;">${esc(p.title)}</h3>
							<div class="card-meta" style="font-size: 0.82rem; color: #0284c7; font-weight: 600; margin-bottom: 14px; display: flex; flex-direction: column; gap: 6px;">
								<span>⏱️ ${esc(dateText)}</span>
								<span>📍 ${esc(s.location || '')} · ${esc(s.execution_mode || '')}</span>
							</div>
							<div class="card-footer" style="display: flex; gap: 10px; margin-top: auto; padding-top: 12px; border-top: 1px solid #f1f5f9;">
								<a href="../registration/registration-personal.html?program=${encodeURIComponent(p.id)}" class="btn btn-primary" style="flex: 1; width: 100%; text-align: center; padding: 10px 14px; background: #0c3866; border-radius: 8px; color: #ffffff; font-weight: 700; font-size: 0.9rem; text-decoration: none;">سجّل الآن</a>
							</div>
						</div>
					</article>`;
		}

		function renderPrograms() {
			let items = monthItems();
			if (state.selectedDay) items = filteredItems().filter(x => dateKey(x.date) === state.selectedDay);
			if (upcomingTitle) upcomingTitle.textContent = state.selectedDay ? `برامج ${fullDateFmt.format(parseDate(state.selectedDay))}` : 'برامج هذا الشهر';
			if (selectionBar) {
				selectionBar.hidden = !state.selectedDay;
				if (state.selectedDay && selectionText) selectionText.textContent = `تم اختيار ${fullDateFmt.format(parseDate(state.selectedDay))}`;
			}
			listEl.innerHTML = items.length ? items.map(renderProgramCard).join('') : '<div class="tc-empty-state">لا توجد برامج مطابقة في هذا الشهر. جرّب تغيير الفلاتر أو الانتقال إلى شهر آخر.</div>';
		}

		function renderAll() { renderMonth(); renderPrograms(); }

		function selectDay(key) {
			state.selectedDay = key;
			const d = parseDate(key);
			if (d && (d.getMonth() !== state.cursor.getMonth() || d.getFullYear() !== state.cursor.getFullYear())) state.cursor = new Date(d.getFullYear(), d.getMonth(), 1, 12);
			renderAll();
			const target = $("#calendarUpcomingTitle");
			if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
		}

		daysEl.addEventListener('click', e => {
			const more = e.target.closest('.tc-more-events');
			const day = e.target.closest('.tc-day-number');
			if (more) { e.preventDefault(); selectDay(more.dataset.date); return; }
			if (day) { e.preventDefault(); selectDay(day.dataset.date); }
		});

		if (todayBtn) todayBtn.addEventListener('click', () => { state.cursor = new Date(); state.selectedDay = null; renderAll(); });
		if (prevBtn) prevBtn.addEventListener('click', () => { state.selectedDay = null; state.cursor = new Date(state.cursor.getFullYear(), state.cursor.getMonth() - 1, 1, 12); renderAll(); });
		if (nextBtn) nextBtn.addEventListener('click', () => { state.selectedDay = null; state.cursor = new Date(state.cursor.getFullYear(), state.cursor.getMonth() + 1, 1, 12); renderAll(); });
		if (clearDayBtn) clearDayBtn.addEventListener('click', () => { state.selectedDay = null; renderAll(); });
		[catSelect, locSelect, modeSelect].filter(Boolean).forEach(sel => sel.addEventListener('change', () => { state.selectedDay = null; renderAll(); }));
		if (resetBtn) resetBtn.addEventListener('click', e => { e.preventDefault();[catSelect, locSelect, modeSelect].filter(Boolean).forEach(s => s.selectedIndex = 0); state.selectedDay = null; renderAll(); });

		// Draw a complete monthly calendar immediately, even before API data arrives.
		renderMonth();
		showSkeleton(listEl);
		ensureAPI(() => {
			Promise.all([window.QEIAPI.getPrograms(), window.QEIAPI.getCategories().catch(() => null)]).then(([res, cats]) => {
				restoreSkeleton(listEl);
				state.programs = (res && res.data) || [];
				state.items = [];
				state.programs.forEach(program => {
					(program.schedules || []).forEach(schedule => {
						const d = parseDate(schedule.start_date);
						if (d) state.items.push({ program, schedule, date: d });
					});
				});

				if (catSelect && cats && cats.data) catSelect.innerHTML = '<option value="">المجال — جميع المجالات</option>' + cats.data.map(c => `<option value="${esc(c.name)}">${esc(c.name)}</option>`).join('');
				if (locSelect) { const locs = [...new Set(state.items.map(x => normalizedLocation(x.schedule)).filter(Boolean))]; locSelect.innerHTML = '<option value="">الموقع — جميع المواقع</option>' + locs.map(v => `<option value="${esc(v)}">${esc(v)}</option>`).join(''); }
				if (modeSelect) { const modes = [...new Set(state.items.map(x => String(x.schedule.execution_mode || '').trim()).filter(Boolean))]; modeSelect.innerHTML = '<option value="">طريقة التنفيذ — الكل</option>' + modes.map(v => `<option value="${esc(v)}">${esc(v)}</option>`).join(''); }

				const today = new Date();
				const hasCurrentMonth = state.items.some(x => x.date.getFullYear() === today.getFullYear() && x.date.getMonth() === today.getMonth());
				if (!hasCurrentMonth && state.items.length) {
					const first = state.items.slice().sort((a, b) => a.date - b.date)[0].date;
					state.cursor = new Date(first.getFullYear(), first.getMonth(), 1, 12);
				}
				renderAll();
			}).catch(err => {
				restoreSkeleton(listEl);
				console.warn('[QEINST API] Monthly calendar load error:', err);
				listEl.innerHTML = '<div class="tc-empty-state">التقويم جاهز للتصفح، لكن تحميل المواعيد يتطلب تشغيل خادم Laravel على المنفذ 8000.</div>';
				renderMonth();
			});
		});
	}

	function wireDateGrid() {
		const grid = $(".rgs-date-grid");
		if (!grid) return;

		const cards = $$("label, .rgs-date-card", grid);
		if (!cards.length) return;

		cards.forEach((card, index) => {
			const radio = $("input[type='radio']", card);

			const updateCardState = () => {
				cards.forEach((c) => {
					c.classList.remove("active", "selected");
					const r = $("input[type='radio']", c);
					if (r) r.checked = false;
				});
				card.classList.add("active", "selected");
				if (radio) {
					radio.checked = true;
					radio.dispatchEvent(new Event("change", { bubbles: true }));
				}
				store.write({ selectedScheduleIndex: index, selectedScheduleText: card.textContent.replace(/\s+/g, " ").trim() });
			};

			if (radio && radio.checked) {
				card.classList.add("active", "selected");
			}

			card.addEventListener("click", () => {
				updateCardState();
			});

			if (radio) {
				radio.addEventListener("change", () => {
					updateCardState();
				});
			}
		});
	}

	function wireGalleryPage() {
		const grid = $(".gallery-list-grid");
		if (!grid) return;

		const filterForm = $(".gallery-list-filters");
		const searchInput = filterForm ? $("input", filterForm) : null;
		const selects = filterForm ? $$("select", filterForm) : [];
		const programSelect = selects[0] || null;
		const yearSelect = selects[1] || null;
		const typeSelect = selects[2] || null;
		const resetBtn = filterForm ? $("button", filterForm) : null;

		let allItems = [];

		const renderItems = (items) => {
			if (!items || !items.length) {
				grid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 4rem 1rem; color: #64748b; font-weight: 700; font-size: 1.1rem;">لا توجد صور مطابقة للبحث حالياً.</div>`;
				return;
			}

			grid.innerHTML = items.map((item, index) => {
				const rawCover = item.cover_image || item.media_path || 'assets/images/gallery/gallery-main.jpg';
				const thumbSrc = /^https?:\/\//i.test(rawCover) ? rawCover : url(rawCover);

				const title = item.title || "من أجواء التدريب";
				const cat = item.category || "فعاليات المعهد";

				return `
					<a class="gallery-card" href="javascript:void(0)" data-index="${index}">
						<div style="position:relative; overflow:hidden; border-radius:16px; aspect-ratio:16/9; background:#f8fafc; box-shadow:0 4px 15px rgba(0,0,0,0.06); transition:transform 0.3s ease, box-shadow 0.3s ease;" onmouseover="this.style.transform='translateY(-5px)'; this.style.boxShadow='0 15px 30px rgba(0,0,0,0.12)';" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 15px rgba(0,0,0,0.06)';">
							<img src="${thumbSrc}" alt="${escapeHtml(title)}" style="width:100%; height:100%; object-fit:cover; transition:transform 0.6s ease;" onmouseover="this.style.transform='scale(1.05)';" onmouseout="this.style.transform='scale(1)';" onerror="this.onerror=null;this.src='${url('assets/images/gallery/gallery-main.jpg')}';" />
						</div>

					</a>
				`;
			}).join("");

			$$(".gallery-card", grid).forEach((card) => {
				card.addEventListener("click", (e) => {
					e.preventDefault();
					const idx = parseInt(card.dataset.index || "0", 10);
					const lbData = items.map(item => {
						let mUrl = item.media_path || item.cover_image;
						if (mUrl && !/^https?:\/\//i.test(mUrl)) mUrl = url(mUrl);
						return {
							src: mUrl,
							alt: item.title,
							type: 'image'
						};
					});
					openLb(lbData, idx);
				});
			});
		};

		function escapeHtml(str) {
			return String(str || '').replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
		}

		function imgPathRelative(path) {
			return path && !path.startsWith("http") && !path.startsWith("/") && !path.startsWith(".");
		}

		function normalizePath(path) {
			if (path.startsWith("http")) return path;
			return "../" + path.replace(/^\//, '');
		}

		function applyFilters() {
			const q = (searchInput ? searchInput.value : '').trim().toLowerCase();

			const filtered = allItems.filter(item => {
				const matchSearch = !q || (item.title && item.title.toLowerCase().includes(q)) || (item.description && item.description.toLowerCase().includes(q));
				return matchSearch;
			});

			renderItems(filtered);
		}

		// Keep the local gallery fallback visible immediately. Live database content
		// replaces it only after a successful response, so visitors never stare at a loader.
		const staticFallbackHTML = grid.innerHTML;
		const staticFallbackCards = $$('.qei-gallery-fallback-card', grid);
		if (staticFallbackCards.length) {
			const localLightbox = staticFallbackCards.map(card => {
				const img = card.querySelector('img');
				return { src: img ? img.src : card.getAttribute('href'), alt: img ? img.alt : 'من أجواء التدريب', type: 'image' };
			});
			staticFallbackCards.forEach((card, index) => card.addEventListener('click', (ev) => {
				ev.preventDefault();
				openLb(localLightbox, index);
			}));
		}
		ensureAPI(() => {
			window.QEIAPI.getGalleries().then(res => {
				if (res && res.status && Array.isArray(res.data) && res.data.length > 0) {
					allItems = res.data.filter(item => item.type === 'image');
					if (allItems.length) renderItems(allItems);
					else grid.innerHTML = staticFallbackHTML;
				} else {
					grid.innerHTML = staticFallbackHTML;
				}
			}).catch(err => {
				grid.innerHTML = staticFallbackHTML;
				console.warn("[QEINST API] Galleries load error; local fallback retained:", err);
			});
		});

		if (searchInput) searchInput.addEventListener("input", applyFilters);
		if (typeSelect) typeSelect.addEventListener("change", applyFilters);
		if (resetBtn) {
			resetBtn.addEventListener("click", (e) => {
				e.preventDefault();
				if (searchInput) searchInput.value = '';
				if (typeSelect) typeSelect.selectedIndex = 0;
				if (programSelect) programSelect.selectedIndex = 0;
				if (yearSelect) yearSelect.selectedIndex = 0;
				renderItems(allItems);
			});
		}
	}

	function wireRegistrationProgramCard() {
		if (!/registration/i.test(location.pathname) || /registration-success/i.test(location.pathname)) return;

		const params = new URLSearchParams(location.search);
		let savedData = store.read() || {};
		const directHeaderEntry = /registration-personal/i.test(location.pathname) && params.get("source") === "header";
		if (directHeaderEntry) {
			store.write({ program_id: null, programId: null, program_name: "", programName: "", selectedProgram: "", schedule_id: null, scheduleId: null, selectedDate: null });
			savedData = store.read() || {};
			try {
				sessionStorage.removeItem("qei_selected_program");
				sessionStorage.removeItem("qei_selected_program_name");
				sessionStorage.removeItem("qei_selected_schedule");
			} catch (e) {}
		}
		let programId = directHeaderEntry ? null : (params.get("program") || params.get("id") || params.get("slug") || params.get("program_id") || params.get("programId"));
		let scheduleId = directHeaderEntry ? null : (params.get("schedule") || params.get("schedule_id") || params.get("scheduleId"));
		const urlProgramName = directHeaderEntry ? "" : (params.get("program_name") || params.get("programName") || params.get("title"));

		try {
			if (!directHeaderEntry && (!programId || programId === 'p1' || programId === 'default')) programId = sessionStorage.getItem("qei_selected_program") || savedData.program_id || savedData.programId;
			if (!directHeaderEntry && !scheduleId) scheduleId = sessionStorage.getItem("qei_selected_schedule") || savedData.schedule_id || savedData.scheduleId;
		} catch (e) { }

		const summaryAside = document.querySelector('.reg-summary') || document.querySelector('.rgs-program-summary') || document.querySelector('.rgr-program') || document.querySelector('aside.reg-summary');
		if (!summaryAside) return;

		const initialTitle = urlProgramName || savedData.program_name || savedData.programName || savedData.selectedProgram || '';

		// The selector is rendered in HTML as a resilient fallback, so changing the
		// program works immediately even when the API is still loading.
		const staticSelect = document.getElementById('qeiProgramQuickSelect');
		if (staticSelect && !staticSelect.dataset.qeiStaticWired) {
			staticSelect.dataset.qeiStaticWired = '1';

			// Compact QEI picker: avoids the browser's very tall native program menu
			// while preserving the original select as the single source of truth.
			if (!staticSelect.dataset.qeiCompactPicker) {
				staticSelect.dataset.qeiCompactPicker = '1';
				staticSelect.classList.add('qei-native-select-enhanced');
				const combo = document.createElement('div');
				combo.className = 'qei-program-combobox';
				combo.innerHTML = `<button type="button" class="qei-program-combobox-btn" aria-haspopup="listbox" aria-expanded="false"><span class="qei-combo-label">اختر البرنامج التدريبي</span><span class="qei-combo-chevron" aria-hidden="true">⌄</span></button><div class="qei-program-combobox-panel" role="listbox"></div>`;
				staticSelect.insertAdjacentElement('afterend', combo);
				const comboBtn = combo.querySelector('.qei-program-combobox-btn');
				const comboLabel = combo.querySelector('.qei-combo-label');
				const comboPanel = combo.querySelector('.qei-program-combobox-panel');
				const addCompactOption = (opt) => {
					const optionBtn = document.createElement('button');
					optionBtn.type = 'button';
					optionBtn.className = 'qei-program-combobox-option';
					optionBtn.dataset.value = opt.value;
					optionBtn.textContent = opt.textContent.trim();
					optionBtn.setAttribute('role', 'option');
					optionBtn.addEventListener('click', () => {
						staticSelect.value = opt.value;
						staticSelect.dispatchEvent(new Event('change', { bubbles: true }));
						combo.classList.remove('open');
						comboBtn.setAttribute('aria-expanded', 'false');
					});
					comboPanel.appendChild(optionBtn);
				};
				const buildCompactPanel = () => {
					comboPanel.innerHTML = '';
					Array.from(staticSelect.children).forEach(node => {
						if (node.tagName === 'OPTGROUP') {
							const group = document.createElement('div');
							group.className = 'qei-program-combobox-group';
							group.textContent = node.label;
							comboPanel.appendChild(group);
							Array.from(node.children).forEach(addCompactOption);
						} else if (node.tagName === 'OPTION' && node.value) {
							addCompactOption(node);
						}
					});
				};
				const syncCompactPicker = () => {
					const selected = staticSelect.options[staticSelect.selectedIndex];
					comboLabel.textContent = selected && selected.value ? selected.textContent.trim() : 'اختر البرنامج التدريبي';
					comboPanel.querySelectorAll('.qei-program-combobox-option').forEach(el => {
						el.setAttribute('aria-selected', String(el.dataset.value === staticSelect.value));
					});
				};
				comboBtn.addEventListener('click', () => {
					const open = !combo.classList.contains('open');
					combo.classList.toggle('open', open);
					comboBtn.setAttribute('aria-expanded', String(open));
				});
				document.addEventListener('click', (ev) => {
					if (!combo.contains(ev.target)) {
						combo.classList.remove('open');
						comboBtn.setAttribute('aria-expanded', 'false');
					}
				});
				staticSelect.addEventListener('change', syncCompactPicker);
				staticSelect.addEventListener('qei-sync', syncCompactPicker);
				buildCompactPanel();
				syncCompactPicker();
			}

			const initialId = programId || savedData.program_id || savedData.programId || '';
			if (initialId) {
				staticSelect.value = String(initialId);
				staticSelect.dispatchEvent(new Event('qei-sync'));
				const immediateName = urlProgramName || staticSelect.options[staticSelect.selectedIndex]?.textContent?.trim() || initialTitle;
				if (immediateName) {
					const titleEl = summaryAside.querySelector('.selected-program-title') || summaryAside.querySelector('h3');
					if (titleEl) titleEl.textContent = immediateName;
					const descP = summaryAside.querySelector('.selected-program-desc');
					if (descP) descP.textContent = 'يمكنك تغيير البرنامج من القائمة أدناه قبل إرسال الطلب.';
				}
			}
			const fallbackPrograms = Array.isArray(window.QEI_PROGRAM_CATALOG_FALLBACK) ? window.QEI_PROGRAM_CATALOG_FALLBACK : [];
			const renderFallbackSummary = (id) => {
				const prog = fallbackPrograms.find(item => String(item.id) === String(id));
				if (!prog) return;
				const imgEl = summaryAside.querySelector('img');
				if (imgEl && (prog.imageUrl || prog.image)) {
					let src = prog.imageUrl || prog.image;
					if (src.startsWith('assets/')) src = '../' + src;
					imgEl.src = src;
					imgEl.alt = prog.title || '';
					imgEl.loading = 'eager';
					imgEl.decoding = 'async';
					imgEl.style.display = 'block';
				}
				const titleEl = summaryAside.querySelector('.selected-program-title') || summaryAside.querySelector('h3');
				if (titleEl) titleEl.textContent = prog.title || '';
				const descP = summaryAside.querySelector('.selected-program-desc');
				if (descP) {
					const duration = prog.duration || [prog.durationDays ? `${prog.durationDays} أيام` : '', prog.durationHours ? `${prog.durationHours} ساعة` : ''].filter(Boolean).join(' • ');
					descP.textContent = duration ? `${duration} — يمكنك تغيير البرنامج قبل إرسال الطلب.` : 'يمكنك تغيير البرنامج قبل إرسال الطلب.';
				}
			};
			if (initialId) renderFallbackSummary(initialId);

			staticSelect.addEventListener('change', () => {
				const id = String(staticSelect.value || '');
				staticSelect.classList.remove('qei-field-error');
				staticSelect.removeAttribute('aria-invalid');
				if (!id) {
					programId = null;
					store.write({ program_id: null, programId: null, program_name: '', programName: '', selectedProgram: '', schedule_id: null, scheduleId: null, selectedDate: null });
					const imgEl = summaryAside.querySelector('img');
					if (imgEl) { imgEl.removeAttribute('src'); imgEl.alt = ''; imgEl.style.display = 'none'; }
					const titleEl = summaryAside.querySelector('.selected-program-title') || summaryAside.querySelector('h3');
					if (titleEl) titleEl.textContent = 'اختر البرنامج التدريبي';
					const descP = summaryAside.querySelector('.selected-program-desc');
					if (descP) descP.textContent = 'اختر البرنامج الذي ترغب بالتسجيل فيه للمتابعة.';
					return;
				}
				const name = staticSelect.options[staticSelect.selectedIndex]?.textContent?.trim() || '';
				programId = id;
				renderFallbackSummary(id);
				scheduleId = null;
				store.write({ program_id: id, programId: id, program_name: name, programName: name, selectedProgram: name, schedule_id: null, scheduleId: null, selectedDate: null });
				try { sessionStorage.setItem('qei_selected_program', id); sessionStorage.setItem('qei_selected_program_name', name); sessionStorage.removeItem('qei_selected_schedule'); } catch (e) {}
				const titleEl = summaryAside.querySelector('.selected-program-title') || summaryAside.querySelector('h3');
				if (titleEl) titleEl.textContent = name;
				const descP = summaryAside.querySelector('.selected-program-desc');
				if (descP) descP.textContent = 'تم تغيير البرنامج. يمكنك تعديله مرة أخرى قبل إرسال الطلب.';
				const q = new URLSearchParams(location.search);
				q.set('program', id);
				q.set('program_name', name);
				['schedule','schedule_id','scheduleId','date','start_date','end_date'].forEach(key => q.delete(key));
				history.replaceState(null, '', location.pathname + '?' + q.toString());
			});
		}

		ensureAPI(() => {
			window.QEIAPI.getPrograms().then(res => {
				if (!res || !Array.isArray(res.data) || !res.data.length) return;
				const programs = res.data;

				const findProgram = () => {
					if (programId && programId !== 'p1' && programId !== 'default') {
						const byId = programs.find(item => String(item.id) === String(programId) || item.slug === programId);
						if (byId) return byId;
					}
					if (initialTitle && initialTitle !== 'لم يتم اختيار برنامج تدريبي') {
						return programs.find(item => item.title === initialTitle || item.title.includes(initialTitle) || initialTitle.includes(item.title)) || null;
					}
					return null;
				};

				const renderProgramSummary = (selectedProg) => {
					if (!selectedProg) return;
					let selectedSched = null;
					if (Array.isArray(selectedProg.schedules) && selectedProg.schedules.length) {
						selectedSched = selectedProg.schedules.find(s => String(s.id) === String(scheduleId)) || selectedProg.schedules[0];
					}
					programId = selectedProg.id;
					scheduleId = selectedSched ? selectedSched.id : null;
					store.write({
						program_id: selectedProg.id,
						programId: selectedProg.id,
						program_name: selectedProg.title,
						programName: selectedProg.title,
						selectedProgram: selectedProg.title,
						schedule_id: scheduleId,
						scheduleId: scheduleId,
						selectedDate: null
					});
					try {
						sessionStorage.setItem('qei_selected_program', String(selectedProg.id));
						sessionStorage.setItem('qei_selected_program_name', selectedProg.title);
						if (scheduleId) sessionStorage.setItem('qei_selected_schedule', String(scheduleId));
					} catch (e) { }

					const imgEl = summaryAside.querySelector('img');
					if (imgEl && selectedProg.image) {
						let imgPath = selectedProg.image;
						if (imgPath.startsWith('assets/')) imgPath = '../' + imgPath;
						else if (!imgPath.startsWith('http') && !imgPath.startsWith('/') && !imgPath.startsWith('.')) imgPath = '../' + imgPath;
						imgEl.src = imgPath;
						imgEl.alt = selectedProg.title;
						imgEl.loading = 'lazy';
						imgEl.decoding = 'async';
						imgEl.style.display = 'block';
					}

					const titleEl = summaryAside.querySelector('.selected-program-title') || summaryAside.querySelector('h3');
					if (titleEl) titleEl.textContent = selectedProg.title;
					const descP = summaryAside.querySelector('.selected-program-desc');
					if (descP) {
						const hours = selectedProg.duration_hours || 25;
						const days = selectedProg.duration_days || 5;
						descP.textContent = `◷ ${hours} ساعة تدريبية (${days} أيام) — يمكنك تغيير البرنامج من القائمة أدناه.`;
					}
					const quickSelect = document.getElementById('qeiProgramQuickSelect');
					if (quickSelect) { quickSelect.value = String(selectedProg.id); quickSelect.dispatchEvent(new Event('qei-sync')); }
				};

				let pickerWrap = document.getElementById('qeiProgramPickerWrap');
				if (!pickerWrap) {
					pickerWrap = document.createElement('div');
					pickerWrap.id = 'qeiProgramPickerWrap';
					pickerWrap.className = 'qei-program-picker-wrap';
					pickerWrap.innerHTML = `
						<label for="qeiProgramQuickSelect">البرنامج التدريبي</label>
						<select id="qeiProgramQuickSelect" class="input-field" aria-label="اختر أو غيّر البرنامج التدريبي">
							<option value="">اختر البرنامج التدريبي</option>
							${programs.map(prog => `<option value="${prog.id}">${prog.title}</option>`).join('')}
						</select>`;
					const actionP = summaryAside.querySelector('.selected-program-action');
					if (actionP) {
						actionP.innerHTML = '';
						actionP.style.display = 'block';
						actionP.appendChild(pickerWrap);
					} else {
						const desc = summaryAside.querySelector('.selected-program-desc');
						(desc || summaryAside.lastElementChild || summaryAside).insertAdjacentElement('afterend', pickerWrap);
					}
				}

				const quickSelect = document.getElementById('qeiProgramQuickSelect');
				if (quickSelect && !quickSelect.dataset.qeiWired) {
					quickSelect.dataset.qeiWired = '1';
					quickSelect.addEventListener('change', (e) => {
						const chosenProg = programs.find(item => String(item.id) === String(e.target.value));
						if (!chosenProg) return;
						scheduleId = Array.isArray(chosenProg.schedules) && chosenProg.schedules.length ? chosenProg.schedules[0].id : null;
						renderProgramSummary(chosenProg);
						const q = new URLSearchParams(location.search);
						q.set('program', chosenProg.id);
						q.set('program_name', chosenProg.title);
						['schedule','schedule_id','scheduleId','date','start_date','end_date'].forEach(key => q.delete(key));
						if (/registration-schedule/i.test(location.pathname)) location.href = location.pathname + '?' + q.toString();
						else history.replaceState(null, '', location.pathname + '?' + q.toString());
					});
				}

				const selected = findProgram();
				if (selected) renderProgramSummary(selected);
				else {
					const titleEl = summaryAside.querySelector('.selected-program-title') || summaryAside.querySelector('h3');
					if (titleEl) titleEl.textContent = 'اختر البرنامج التدريبي';
					const descP = summaryAside.querySelector('.selected-program-desc');
					if (descP) descP.textContent = 'اختر البرنامج الذي ترغب بالتسجيل فيه، ويمكنك تغييره في أي وقت قبل إرسال الطلب.';
				}
			}).catch(err => console.warn('[QEINST API] Registration program selector error:', err));
		});
	}

	/* ---------------------------------------------------------------- bootstrap */

	function wireHomePage() {
		const featGrid = document.getElementById("featuredProgramsGrid");
		if (featGrid) showSkeleton(featGrid);

		const corpGrid = document.getElementById("homeCorporateSolutionsGrid");
		if (corpGrid) showSkeleton(corpGrid);

		const hGalleryGrid = document.getElementById("homeGalleryGrid");
		if (hGalleryGrid) {
			/* Keep the HTML fallback visible until live gallery data is ready. */
			ensureAPI(() => {
				window.QEIAPI.getGalleries().then(res => {
					if (res && res.status && Array.isArray(res.data) && res.data.length > 0) {
						const images = res.data.filter(i => i.type === 'image').slice(0, 8);
						hGalleryGrid.innerHTML = images.map(img => {
							const src = img.media_path || img.cover_image || 'assets/images/gallery/gallery-main.jpg';
							return `<a class="home-gallery-item" href="${url('gallery/gallery.html')}"><img src="${/^https?:\/\//i.test(src) ? src : url(src)}" alt="${qeiEscapeHTML(img.title || 'فعالية تدريبية')}" loading="lazy" decoding="async" /></a>`;
						}).join('');
					}
				}).catch(err => {
					console.warn("[QEINST API] Home gallery fallback retained:", err);
				});
			});
		}

		const solPageGrid = document.getElementById("solutionsPageGrid");
		if (solPageGrid && solPageGrid.children.length === 0) showSkeleton(solPageGrid);
	}

	function wireProgramDetails() {
		if (!/program-details/i.test(location.pathname)) return;
		const params = new URLSearchParams(location.search);
		const requestedSlug = params.get('slug') || params.get('id') || params.get('program');

		if (window.QEIAPI && typeof window.QEIAPI.getPrograms === "function") {
			const programRequest = requestedSlug && typeof window.QEIAPI.getProgramBySlug === "function"
				? window.QEIAPI.getProgramBySlug(requestedSlug)
				: window.QEIAPI.getPrograms({ limit: 1 }).then(res => {
						if (!res || !Array.isArray(res.data) || !res.data.length) throw new Error("لا توجد برامج تدريبية نشطة");
						return { status: true, data: res.data[0] };
					});
			programRequest.then(res => {
				if (!res || !res.data) return;
				const p = res.data;

				const titleEl = $("h1", $(".pd-hero, .program-header, main")) || $("h1");
				if (titleEl) titleEl.textContent = p.title;

				document.title = p.title + " | QEI — معهد خبراء الجودة للتدريب";

				const descEl = $(".pd-desc") || $(".program-summary") || $("main p");
				if (descEl && p.summary) descEl.textContent = p.summary;

				const bodyEl = $(".pd-body") || $(".program-description");
				if (bodyEl && p.description) bodyEl.textContent = p.description;

				const durationEl = $(".pd-meta-duration") || $(".duration-val");
				if (durationEl) durationEl.textContent = `${p.duration_hours || 25} ساعة تدريبية (${p.duration_days || 5} أيام)`;

				const levelEl = $(".pd-meta-level") || $(".level-val");
				if (levelEl) levelEl.textContent = p.level || 'متوسط';

				const regBtns = $$("a[href*='registration-personal']");
				regBtns.forEach(btn => {
					btn.href = `../registration/registration-personal.html?program=${p.id}&program_name=${encodeURIComponent(p.title)}`;
				});

				const enrollButtons = $$("#page-program-details .pd-actions button, #page-program-details .pd-enroll button, .pd-actions button, .pd-enroll button");
				enrollButtons.forEach(btn => {
					if (/سجل/.test(btn.textContent)) {
						btn.onclick = (e) => {
							e.preventDefault();
							const schedId = p.schedules && p.schedules.length ? p.schedules[0].id : '';
							window.location.href = `../registration/registration-personal.html?program=${p.id}&program_name=${encodeURIComponent(p.title)}`;
						};
					}
				});
			}).catch(err => console.warn("[QEINST API] Program details load error:", err));
		}
	}

	function wireSearchResults() {
		if (!/search-results/i.test(location.pathname)) return;
		const params = new URLSearchParams(location.search);
		const query = (params.get('q') || params.get('query') || params.get('search') || '').trim();

		const inputEl = document.getElementById("searchQueryResult");
		if (inputEl && query) inputEl.value = query;

		const renderResults = (q) => {
			if (!q) return;
			const listContainer = $(".sr-list") || $("main.sr-list");
			if (!listContainer) return;

			const headerCount = $(".sr-header p");

			if (window.QEIAPI && typeof window.QEIAPI.getPrograms === "function") {
				window.QEIAPI.getPrograms({ search: q }).then((progRes) => {
					const programs = (progRes && progRes.data) || [];
					const total = programs.length;

					if (headerCount) {
						headerCount.textContent = `عرض ${total} نتيجة عن "${q}"`;
					}

					if (total === 0) {
						const emptySec = $(".sr-empty");
						if (emptySec) emptySec.style.display = "block";
						return;
					}

					const emptySec = $(".sr-empty");
					if (emptySec) emptySec.style.display = "none";

					listContainer.innerHTML = "";

					programs.forEach(p => {
						const rawImg = p.image || p.image_url || 'assets/images/programs/course-placeholder.jpg';
						const imgPath = /^https?:\/\//i.test(rawImg) ? rawImg : url(rawImg);
						const modes = Array.isArray(p.schedules)
							? [...new Set(p.schedules.flatMap(s => String(s.execution_mode || '').split(/\s*[/|،]\s*/)).filter(Boolean))]
							: [];
						const modeText = modes.length ? modes.join(' / ') : 'يحدد عند الجدولة';
						const card = document.createElement("article");
						card.className = "sr-card";
						card.innerHTML = `
							<img src="${imgPath}" alt="${p.title}" />
							<div>
								<span>برنامج تدريبي</span>
								<h2>${p.title}</h2>
								<p>${p.summary || ''}</p>
								<div class="sr-meta"><small>◷ ${p.duration_days || 5} أيام</small><small>▦ ${p.level || 'متوسط'}</small><small>● ${modeText}</small></div>
								<a href="../programs/program-details.html?slug=${p.slug || p.id}">عرض التفاصيل <b>←</b></a>
							</div>
						`;
						listContainer.appendChild(card);
					});
				}).catch(err => console.warn("[QEINST API] Search load error:", err));
			}
		};

		if (query) renderResults(query);

		if (inputEl) {
			inputEl.addEventListener("keydown", (e) => {
				if (e.key === "Enter") {
					e.preventDefault();
					const val = inputEl.value.trim();
					if (val) {
						const newUrl = `${location.pathname}?q=${encodeURIComponent(val)}`;
						history.pushState(null, "", newUrl);
						renderResults(val);
					}
				}
			});
		}
	}

	function wireAuthUserSession() {
		const userJson = localStorage.getItem("qei_user");
		if (!userJson) return;
		try {
			const user = JSON.parse(userJson);
			if (!user || !user.full_name) return;

			const loginBtns = $$(".login-btn, a[href*='registration-personal']");
			const firstName = user.full_name.split(' ')[0];

			loginBtns.forEach(btn => {
				if (btn.classList.contains("login-btn") || btn.textContent.includes("تسجيل الدخول")) {
					btn.textContent = `👤 أهلاً، ${firstName}`;
					btn.href = "javascript:void(0)";
					btn.onclick = (e) => {
						e.preventDefault();
						if (confirm(`مرحباً بك ${user.full_name}\nهل ترغب في تسجيل الخروج؟`)) {
							const finishLogout = () => {
								localStorage.removeItem("qei_user");
								localStorage.removeItem("qei_token");
								toast("تم تسجيل الخروج بنجاح");
								setTimeout(() => location.reload(), 350);
							};
							if (window.QEIAPI && typeof window.QEIAPI.logout === "function" && localStorage.getItem("qei_token")) {
								window.QEIAPI.logout().catch(() => null).finally(finishLogout);
							} else finishLogout();
						}
					};
				}
			});
		} catch (e) { }
	}

	function init() {
		wireHomePage()
		wireLang()
		wireNewsletter()
		wireForms()
		wireCorporateRequestWizard()
		wireCorporateRequestSuccess()
		wireFilterGroups()
		wireResetFilters()
		wirePagination()
		wireLoadMore()
		wireGallery()
		wireGalleryPage()
		wireShare()
		wireSocial()
		wireModals()
		wireAccordions()
		wireMobileMenu()
		wireDropdownToggle()
		wireSearchResults()
		wireFieldNames()
		// Calendar page is handled by assets/js/calendar-page.js (single source of truth).
		// Programs listing is handled by app.js (single source of truth).
		wireClientsListing()
		wireRegistrationProgramCard()
		wireMisc()
		wireChipToggles()
		wireLightboxFallback()
		wireSelectFilters()
		populateReview();
		wireGlobalNavigation();
		wireProgramDetails();
		wireDateGrid();
		wireWorkStatusChoices();
		wireScheduleDateTools();
		wireAuthLoginForm();
		wireAuthUserSession();
		wireSuccessPage();

		const reviewSubmitBtn = $(".rgr-actions button.submit, .rgr-actions button[type='button'].submit, button.submit");
		if (reviewSubmitBtn) {
			reviewSubmitBtn.addEventListener("click", (e) => {
				e.preventDefault();
				api.regSubmit();
			});
		}
	}


	function wireSuccessPage() {
		const numEl = document.getElementById('rss-reg-number');
		const dateEl = document.getElementById('rss-reg-date');
		const programSection = document.querySelector('.rss-program');
		if (!numEl && !dateEl && !programSection) return;

		const params = new URLSearchParams(location.search);
		const queryNum = params.get('registration_number') || params.get('order') || params.get('id');

		const saved = store.read() || {};
		let regNum = queryNum || saved.registration_number || null;

		if (!regNum && numEl && numEl.textContent && !numEl.textContent.includes('جارٍ')) {
			regNum = numEl.textContent.trim();
		}
		if (!regNum) {
			regNum = 'QEI-' + new Date().getFullYear() + '-00482';
		}

		store.write({ registration_number: regNum });

		const submittedAt = saved.submittedAt ? new Date(saved.submittedAt) : new Date();

		// Format date in Arabic
		const dateStr = submittedAt.toLocaleDateString('ar-SA', {
			weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
		});
		const timeStr = submittedAt.toLocaleTimeString('ar-SA', {
			hour: '2-digit', minute: '2-digit'
		});

		if (numEl) {
			numEl.textContent = regNum;
		}
		if (dateEl) {
			dateEl.textContent = 'تاريخ التقديم: ' + dateStr + ' - ' + timeStr;
		}

		// Update Program Card in Success Page
		if (programSection) {
			let progTitle = saved.program_name || saved.programName || saved.selectedProgram || saved.course_name;
			let progId = saved.program_id || saved.programId;
			try {
				if (!progId) progId = sessionStorage.getItem('qei_selected_program');
				if (!progTitle || progTitle.includes('المعتمد') || progTitle.includes('لم يتم')) {
					progTitle = sessionStorage.getItem('qei_selected_program_name') || sessionStorage.getItem('qei_selected_program_title');
				}
			} catch (e) { }

			const titleEl = programSection.querySelector('h2');
			const imgEl = programSection.querySelector('img');
			const pTags = programSection.querySelectorAll('p');

			const applyProgramData = (p) => {
				if (!p) return;
				if (titleEl) titleEl.textContent = p.title;
				if (imgEl) {
					let imgPath = p.image || p.imageUrl || '../assets/images/programs/course-placeholder.jpg';
					if (imgPath.startsWith("assets/")) imgPath = "../" + imgPath;
					else if (!imgPath.startsWith("http") && !imgPath.startsWith("/") && !imgPath.startsWith(".")) imgPath = "../" + imgPath;
					imgEl.src = imgPath;
					imgEl.alt = p.title;
				}
				if (pTags && pTags.length >= 2) {
					pTags[1].textContent = `◷ المدة: ${p.duration_hours || 25} ساعة تدريبية (${p.duration_days || 5} أيام)`;
				}
			};

			// Synchronous check from memory (window.QEI.programs)
			if (window.QEI && window.QEI.programs && window.QEI.programs.length) {
				const list = window.QEI.programs;
				let p = null;
				if (progId && progId !== 'p1' && progId !== 'default') {
					p = list.find(item => String(item.id) === String(progId) || item.slug === progId);
				}
				if (!p && progTitle && !progTitle.includes('المعتمد')) {
					p = list.find(item => item.title === progTitle || item.title.includes(progTitle) || progTitle.includes(item.title));
				}
				if (!p && list.length) {
					p = list.find(item => item.title.includes('القيادي') || item.title.includes('التميز')) || list[0];
				}
				if (p) applyProgramData(p);
			} else if (progTitle && !progTitle.includes('المعتمد')) {
				if (titleEl) titleEl.textContent = progTitle;
				if (imgEl) imgEl.alt = progTitle;
			} else {
				// Default flagship course
				if (titleEl) titleEl.textContent = "أفضل ممارسات التميز القيادي والأداء الإبداعي";
			}

			if (pTags && pTags.length >= 3) {
				pTags[0].textContent = `▦ حالة الدورة: متاح للتسجيل المباشر`;
				pTags[1].textContent = `◷ المدة: ${saved.duration_hours || 25} ساعة تدريبية`;
				pTags[2].textContent = `⌖ الموقع: ${saved.selectedLocation || 'الرياض - مقر المعهد'}`;
			}

			ensureAPI(() => {
				window.QEIAPI.getPrograms().then(res => {
					if (!res || !res.data || !res.data.length) return;
					const programs = res.data;
					let p = null;
					if (progId && progId !== 'p1' && progId !== 'default') {
						p = programs.find(item => String(item.id) === String(progId) || item.slug === progId);
					}
					if (!p && progTitle && !progTitle.includes('المعتمد')) {
						p = programs.find(item => item.title === progTitle || item.title.includes(progTitle) || progTitle.includes(item.title));
					}
					if (!p && programs.length) {
						p = programs.find(item => item.title.includes('القيادي') || item.title.includes('التميز')) || programs[0];
					}
					if (p) applyProgramData(p);
				}).catch(e => console.warn("[QEINST API] Success page program load error:", e));
			});
		}
	}

	function wireScheduleDateTools() {
		const groups = $$(".rgs-date-tools > div");
		if (!groups.length) return;

		groups.forEach((group) => {
			const buttons = $$("button", group);
			buttons.forEach((btn) => {
				btn.type = "button";
				btn.addEventListener("click", (e) => {
					e.preventDefault();
					buttons.forEach((b) => b.classList.remove("active"));
					btn.classList.add("active");
				});
			});
		});
	}

	function wireWorkStatusChoices() {
		const choices = $$(".rgw-choice");
		if (!choices.length) return;

		choices.forEach((label) => {
			const radio = $("input[type='radio']", label);
			if (!radio) return;

			const updateState = () => {
				const fieldset = label.closest("fieldset") || label.parentElement;
				if (fieldset) {
					$$(".rgw-choice", fieldset).forEach((c) => c.classList.remove("active"));
				}
				if (radio.checked) {
					label.classList.add("active");
				}
			};

			if (radio.checked) label.classList.add("active");

			label.addEventListener("click", () => {
				radio.checked = true;
				radio.dispatchEvent(new Event("change", { bubbles: true }));
				updateState();
			});

			radio.addEventListener("change", () => {
				updateState();
			});
		});
	}

	function wireDropdownToggle() {
		document.addEventListener("click", function (e) {
			const toggle = e.target.closest(".dropdown-toggle")
			if (toggle) {
				e.preventDefault()
				const parent = toggle.closest(".nav-item-dropdown")
				if (parent) {
					parent.classList.toggle("is-open")
				}
				return
			}
			const menuLink = e.target.closest(".dropdown-menu a")
			if (menuLink) {
				const href = menuLink.getAttribute("href") || ""
				if (href && href !== "#" && !href.startsWith("javascript:")) {
					e.preventDefault()
					$$(".nav-item-dropdown.is-open").forEach((el) => el.classList.remove("is-open"))
					window.location.href = menuLink.href
					return
				}
			}
			if (!e.target.closest(".nav-item-dropdown")) {
				$$(".nav-item-dropdown.is-open").forEach((el) => el.classList.remove("is-open"))
			}
		})
	}

	function wireAuthLoginForm() {
		document.addEventListener("submit", function (e) {
			const form = e.target
			if (!form || !form.matches("form")) return
			const isLoginForm = form.closest("#modal-login, .modal-box") || /login|تسجيل الدخول/i.test(form.innerHTML)
			if (!isLoginForm) return

			const inputs = Array.from(form.querySelectorAll("input"))
			const loginInput = inputs.find(i => i.type === "text" || i.type === "email" || /username|email|login/i.test(i.name || i.id || i.placeholder))
			const passwordInput = inputs.find(i => i.type === "password")
			if (!loginInput || !passwordInput) return

			e.preventDefault()
			e.stopPropagation()

			const loginVal = loginInput.value.trim()
			const passVal = passwordInput.value.trim()

			if (!loginVal || !passVal) {
				toast("يرجى إدخال البريد الإلكتروني/الهوية وكلمة المرور", "error")
				return
			}

			if (window.QEIAPI && typeof window.QEIAPI.login === "function") {
				window.QEIAPI.login(loginVal, passVal).then(res => {
					if (res.status) {
						toast(res.message || "تم تسجيل الدخول بنجاح!")
						localStorage.setItem("qei_user", JSON.stringify(res.user))
						if (res.token) localStorage.setItem("qei_token", res.token)
						if (window.QEI && typeof QEI.closeModal === "function") QEI.closeModal("modal-login")
					} else {
						toast(res.message || "بيانات الدخول غير صحيحة", "error")
					}
				}).catch(err => {
					toast(err.message || "عفواً، تعذر الاتصال بسيرفر التسجيل", "error")
				})
			} else {
				toast("تم تسجيل الدخول بنجاح!")
				if (window.QEI && typeof QEI.closeModal === "function") QEI.closeModal("modal-login")
			}
		}, true)
	}

	if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init)
	else init()

	// Expose the additions on the existing QEI namespace (keeps inline onclick working).
	if (typeof QEI !== "undefined" && QEI) {
		Object.assign(QEI, api);
	}
	window.QEI = Object.assign(window.QEI || {}, api);
	if (typeof QEI !== "undefined" && QEI) {
		Object.assign(QEI, window.QEI);
	}
	window.QEIUI = api
})()

