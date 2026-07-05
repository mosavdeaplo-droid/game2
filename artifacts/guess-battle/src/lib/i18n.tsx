import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

export type Language = "en" | "ar";

const STORAGE_KEY = "guess-battle-language";

const dictionaries = {
  en: {
    "app.title": "Guess Battle",
    "app.tagline": "The Ultimate Number Duel",
    "status.connected": "CONNECTED",
    "status.disconnected": "DISCONNECTED",

    "home.chooseAlias": "Choose your alias",
    "home.usernamePlaceholder": "Username (2-20 chars)",
    "home.start": "Start",
    "home.invalidUsername": "Invalid username",
    "home.invalidUsernameDesc": "Must be 2-20 characters",
    "home.registerFailed": "Failed to register",
    "home.createRoom": "Create Room",
    "home.createRoomFailed": "Failed to create room",
    "home.joinRoomFailed": "Failed to join room",
    "home.roomCodePlaceholder": "ROOM CODE",
    "home.joinGame": "Join Game",
    "home.leaderboard": "Leaderboard",
    "home.profile": "Profile",
    "home.roomSettings": "Room settings",
    "home.numberRange": "Number range",
    "home.roundsToWin": "Rounds to win",
    "home.startCustomGame": "Create with these settings",

    "leaderboard.title": "Leaderboard",
    "leaderboard.back": "Back",
    "leaderboard.empty": "No players yet — be the first to climb the ranks!",
    "leaderboard.wins": "W",
    "leaderboard.losses": "L",
    "leaderboard.coins": "c",

    "profile.title": "Profile",
    "profile.back": "Back",
    "profile.wins": "Wins",
    "profile.losses": "Losses",
    "profile.coins": "Coins",
    "profile.rank": "Rank",
    "profile.winRate": "Win Rate",
    "profile.matches": "Matches",
    "profile.recentMatches": "Recent Matches",
    "profile.noMatches": "No matches played yet",
    "profile.notFound": "Player Not Found",
    "profile.returnHome": "Return Home",
    "profile.win": "WIN",
    "profile.loss": "LOSS",

    "room.waitingForOpponent": "Waiting for opponent...",
    "room.roomCode": "ROOM",
    "room.shareCode": "Share code",
    "room.pickSecret": "Pick Your Secret Number",
    "room.pickSecretDesc": "Choose a number between {min} and {max}. Your opponent will try to guess it.",
    "room.secretPlaceholder": "Enter a number",
    "room.lockIn": "Lock In",
    "room.waitingOpponentSecret": "Waiting for opponent to pick...",
    "room.yourTurn": "YOUR TURN",
    "room.opponentTurn": "OPPONENT'S TURN",
    "room.guessPlaceholder": "?",
    "room.guess": "GUESS",
    "room.skip": "Skip",
    "room.higher": "Higher",
    "room.lower": "Lower",
    "room.correct": "correct",
    "room.matchOver": "MATCH OVER",
    "room.roundOver": "ROUND OVER",
    "room.backToHome": "Back to Home",
    "room.matchChat": "MATCH CHAT",
    "room.chatPlaceholder": "Message...",
    "room.opponentLeftTitle": "Opponent Left",
    "room.opponentLeftDesc": "The other player has disconnected from the room.",
    "room.returnHome": "Return Home",
    "room.you": "You",
    "room.waitingLabel": "Waiting...",
    "room.wins": "WINS",
    "room.vs": "VS",
    "room.round": "ROUND",
  },
  ar: {
    "app.title": "جيس باتل",
    "app.tagline": "أقوى مبارزة أرقام",
    "status.connected": "متصل",
    "status.disconnected": "غير متصل",

    "home.chooseAlias": "اختار اسمك",
    "home.usernamePlaceholder": "اسم المستخدم (٢-٢٠ حرف)",
    "home.start": "ابدأ",
    "home.invalidUsername": "اسم غير صالح",
    "home.invalidUsernameDesc": "لازم يكون من ٢ إلى ٢٠ حرف",
    "home.registerFailed": "فشل التسجيل",
    "home.createRoom": "إنشاء غرفة",
    "home.createRoomFailed": "فشل إنشاء الغرفة",
    "home.joinRoomFailed": "فشل الانضمام للغرفة",
    "home.roomCodePlaceholder": "كود الغرفة",
    "home.joinGame": "انضم للعبة",
    "home.leaderboard": "المتصدرين",
    "home.profile": "الملف الشخصي",
    "home.roomSettings": "إعدادات الغرفة",
    "home.numberRange": "نطاق الأرقام",
    "home.roundsToWin": "عدد الجولات للفوز",
    "home.startCustomGame": "إنشاء بهذه الإعدادات",

    "leaderboard.title": "قائمة المتصدرين",
    "leaderboard.back": "رجوع",
    "leaderboard.empty": "لسه مفيش لاعبين — كن أول واحد يتصدر!",
    "leaderboard.wins": "فوز",
    "leaderboard.losses": "خسارة",
    "leaderboard.coins": "عملة",

    "profile.title": "الملف الشخصي",
    "profile.back": "رجوع",
    "profile.wins": "الانتصارات",
    "profile.losses": "الهزائم",
    "profile.coins": "العملات",
    "profile.rank": "الرتبة",
    "profile.winRate": "نسبة الفوز",
    "profile.matches": "المباريات",
    "profile.recentMatches": "آخر المباريات",
    "profile.noMatches": "لسه معملتش أي مباريات",
    "profile.notFound": "اللاعب مش موجود",
    "profile.returnHome": "الرجوع للرئيسية",
    "profile.win": "فوز",
    "profile.loss": "خسارة",

    "room.waitingForOpponent": "في انتظار الخصم...",
    "room.roomCode": "الغرفة",
    "room.shareCode": "شارك الكود",
    "room.pickSecret": "اختار رقمك السري",
    "room.pickSecretDesc": "اختار رقم من {min} لـ {max}. خصمك هيحاول يخمنه.",
    "room.secretPlaceholder": "اكتب رقم",
    "room.lockIn": "تأكيد",
    "room.waitingOpponentSecret": "في انتظار الخصم يختار رقمه...",
    "room.yourTurn": "دورك",
    "room.opponentTurn": "دور الخصم",
    "room.guessPlaceholder": "؟",
    "room.guess": "خمّن",
    "room.skip": "تخطي",
    "room.higher": "أعلى",
    "room.lower": "أقل",
    "room.correct": "صح",
    "room.matchOver": "انتهى الماتش",
    "room.roundOver": "انتهت الجولة",
    "room.backToHome": "رجوع للرئيسية",
    "room.matchChat": "شات المباراة",
    "room.chatPlaceholder": "رسالة...",
    "room.opponentLeftTitle": "الخصم غادر",
    "room.opponentLeftDesc": "اللاعب التاني قطع الاتصال من الغرفة.",
    "room.returnHome": "الرجوع للرئيسية",
    "room.you": "أنت",
    "room.waitingLabel": "في الانتظار...",
    "room.wins": "فوز",
    "room.vs": "ضد",
    "room.round": "الجولة",
  },
} as const;

export type TranslationKey = keyof typeof dictionaries["en"];

interface I18nContextValue {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string;
  dir: "ltr" | "rtl";
}

const I18nContext = createContext<I18nContextValue | null>(null);

function getInitialLanguage(): Language {
  if (typeof window === "undefined") return "en";
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return stored === "ar" ? "ar" : "en"; // English is the default
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(getInitialLanguage);

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    window.localStorage.setItem(STORAGE_KEY, lang);
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
    document.documentElement.lang = lang;
  }, []);

  const t = useCallback(
    (key: TranslationKey, vars?: Record<string, string | number>) => {
      const template = dictionaries[language][key] ?? dictionaries.en[key] ?? key;
      if (!vars) return template;
      return Object.entries(vars).reduce(
        (acc, [k, v]) => acc.replaceAll(`{${k}}`, String(v)),
        template,
      );
    },
    [language],
  );

  const value = useMemo(
    () => ({ language, setLanguage, t, dir: (language === "ar" ? "rtl" : "ltr") as "ltr" | "rtl" }),
    [language, setLanguage, t],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error("useI18n must be used within an I18nProvider");
  }
  return ctx;
}
