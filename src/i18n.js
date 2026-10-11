import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

// Basic translations
const resources = {
  EN: {
    translation: {
      "settings_title": "PROFILE SETTINGS.",
      "account_info": "ACCOUNT INFO",
      "full_name": "FULL NAME",
      "email_address": "EMAIL ADDRESS",
      "language": "LANGUAGE",
      "save_changes": "SAVE CHANGES",
      "notifications": "NOTIFICATIONS",
      "weekly_digest": "WEEKLY DIGEST",
      "test_reminders": "TEST REMINDERS",
      "save_prefs": "SAVE PREFERENCES",
      "security": "SECURITY.",
      "change_password": "CHANGE PASSWORD",
      "current_pwd": "CURRENT PASSWORD",
      "new_pwd": "NEW PASSWORD",
      "confirm_pwd": "CONFIRM NEW PASSWORD",
      "update_pwd": "UPDATE PASSWORD",
      "loading": "Loading...",
      "fetching_settings": "Fetching your settings",
    }
  },
  UZ: {
    translation: {
      "settings_title": "PROFIL SOZLAMALARI.",
      "account_info": "HISOB MA'LUMOTLARI",
      "full_name": "TO'LIQ ISM",
      "email_address": "ELEKTRON MANZIL",
      "language": "TIL",
      "save_changes": "O'ZGARISHLARNI SAQLASH",
      "notifications": "BILDIRISHNOMALAR",
      "weekly_digest": "HAFTALIK HISOBOT",
      "test_reminders": "TEST ESLATMALARI",
      "save_prefs": "SOZLAMALARNI SAQLASH",
      "security": "XAVFSIZLIK.",
      "change_password": "PAROLNI O'ZGARTIRISH",
      "current_pwd": "JORIY PAROL",
      "new_pwd": "YANGI PAROL",
      "confirm_pwd": "YANGI PAROLNI TASDIQLASH",
      "update_pwd": "PAROLNI YANGILASH",
      "loading": "Yuklanmoqda...",
      "fetching_settings": "Sozlamalaringiz olinmoqda",
    }
  },
  RU: {
    translation: {
      "settings_title": "НАСТРОЙКИ ПРОФИЛЯ.",
      "account_info": "ДАННЫЕ АККАУНТА",
      "full_name": "ПОЛНОЕ ИМЯ",
      "email_address": "ЭЛЕКТРОННАЯ ПОЧТА",
      "language": "ЯЗЫК",
      "save_changes": "СОХРАНИТЬ ИЗМЕНЕНИЯ",
      "notifications": "УВЕДОМЛЕНИЯ",
      "weekly_digest": "ЕЖЕНЕДЕЛЬНЫЙ ДАЙДЖЕСТ",
      "test_reminders": "НАПОМИНАНИЯ О ТЕСТАХ",
      "save_prefs": "СОХРАНИТЬ НАСТРОЙКИ",
      "security": "БЕЗОПАСНОСТЬ.",
      "change_password": "ИЗМЕНИТЬ ПАРОЛЬ",
      "current_pwd": "ТЕКУЩИЙ ПАРОЛЬ",
      "new_pwd": "НОВЫЙ ПАРОЛЬ",
      "confirm_pwd": "ПОДТВЕРДИТЕ НОВЫЙ ПАРОЛЬ",
      "update_pwd": "ОБНОВИТЬ ПАРОЛЬ",
      "loading": "Загрузка...",
      "fetching_settings": "Получение ваших настроек",
    }
  }
}

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: "EN", // default language
    fallbackLng: "EN",
    interpolation: {
      escapeValue: false
    }
  })

export default i18n
