const fs = require('fs');
const path = require('path');

const LOCALE_DIR = path.join(__dirname, '..', 'locate');
const SUPPORTED_LOCALES = ['vi', 'en-US']; // ưu tiên tiếng Việt trước
const DEFAULT_LOCALE = normalizeLocale(process.env.DEFAULT_LOCALE) || 'vi';
const FALLBACK_LOCALE = normalizeLocale(process.env.FALLBACK_LOCALE) || 'en-US';
const AI_RESPONSE_LOCALE = normalizeLocale(process.env.AI_RESPONSE_LOCALE) || 'vi';
const AUTO_DETECT_LOCALE = process.env.APP_AUTO_DETECT_LOCALE === 'true';

const translations = loadTranslations();

function loadTranslations() {
	const result = {};
	for (const locale of SUPPORTED_LOCALES) {
		const localeFile = path.join(LOCALE_DIR, `${locale}.json`);
		try {
			const fileContent = fs.readFileSync(localeFile, 'utf8');
			result[locale] = JSON.parse(fileContent);
		} catch (error) {
			result[locale] = {};
		}
	}
	return result;
}

function normalizeLocale(locale) {
	if (!locale || typeof locale !== 'string') {
		return undefined;
	}

	const lower = locale.toLowerCase();
	if (SUPPORTED_LOCALES.includes(lower)) {
		return lower;
	}

	const base = lower.split('-')[0];
	if (SUPPORTED_LOCALES.includes(base)) {
		return base;
	}

	return undefined;
}

function getLocalesFromContext(context) {
	const locales = [];

	// Luôn ưu tiên locale mặc định (tiếng Việt) trước
	if (!locales.includes(DEFAULT_LOCALE)) {
		locales.push(DEFAULT_LOCALE);
	}

	// Auto-detect locale từ Discord nếu được bật
	if (AUTO_DETECT_LOCALE) {
		if (typeof context === 'string') {
			const normalized = normalizeLocale(context);
			if (normalized && !locales.includes(normalized)) {
				locales.push(normalized);
			}
		} else if (context) {
			const candidates = [
				context.locale,
				context.guildLocale,
				context.preferredLocale,
				context?.user?.locale,
				context?.userLocale,
				context?.guild?.preferredLocale,
				context?.author?.locale,
			];

			for (const candidate of candidates) {
				const normalized = normalizeLocale(candidate);
				if (normalized && !locales.includes(normalized)) {
					locales.push(normalized);
				}
			}
		}
	}

	// Thêm fallback locale nếu chưa có
	if (!locales.includes(FALLBACK_LOCALE)) {
		locales.push(FALLBACK_LOCALE);
	}

	// Thêm các locale khác nếu chưa có
	for (const locale of SUPPORTED_LOCALES) {
		if (!locales.includes(locale)) {
			locales.push(locale);
		}
	}

	return locales;
}

function getTranslationForLocale(locale, key) {
	const segments = key.split('.');
	let current = translations[locale];

	for (const segment of segments) {
		if (current && Object.prototype.hasOwnProperty.call(current, segment)) {
			current = current[segment];
		} else {
			return undefined;
		}
	}

	return current;
}

function formatMessage(message, variables = {}) {
	if (typeof message !== 'string') {
		return message;
	}

	return message.replace(/\{(\w+)\}/g, (_, token) => {
		if (Object.prototype.hasOwnProperty.call(variables, token)) {
			return variables[token];
		}
		return `{${token}}`;
	});
}

function translate(contextOrLocale, key, variables) {
	const locales = getLocalesFromContext(contextOrLocale);

	for (const locale of locales) {
		const translation = getTranslationForLocale(locale, key);
		if (translation !== undefined) {
			return formatMessage(translation, variables);
		}
	}

	return formatMessage(key, variables);
}

function multiTranslate(key, variables) {
	const result = {};
	for (const locale of SUPPORTED_LOCALES) {
		result[locale] = translate(locale, key, variables);
	}
	return result;
}

module.exports = {
	DEFAULT_LOCALE,
	FALLBACK_LOCALE,
	AI_RESPONSE_LOCALE,
	SUPPORTED_LOCALES,
	AUTO_DETECT_LOCALE,
	translate,
	multiTranslate,
	normalizeLocale,
};
