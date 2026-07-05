import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";

export function LanguageSwitcher() {
  const { language, setLanguage } = useI18n();

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => setLanguage(language === "en" ? "ar" : "en")}
      className="font-mono border-primary/30 hover:bg-primary/10 hover:text-primary"
      data-testid="button-language-switcher"
    >
      {language === "en" ? "AR" : "EN"}
    </Button>
  );
}
