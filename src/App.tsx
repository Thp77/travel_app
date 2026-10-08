import { useEffect, useState, type Dispatch, type SetStateAction } from "react";

type Category =
  | "Logement"
  | "Nourriture"
  | "Transport"
  | "Activités"
  | "Shopping"
  | "Santé"
  | "Extras";

type Expense = {
  id: number;
  amount: number;
  category: Category;
};

type Country = {
  id: number;
  name: string;
  flag: string;
  budget: number;
  imageUrl: string;
  startDate: string;
  endDate: string | null;
  expenses: Expense[];
  closed: boolean;
};

type CountryWithDaily = Country & {
  total: number;
  days: number;
  daily: number;
};

type BudgetScore = {
  label: string;
  color: string;
  score: number;
  stars: number;
};

type Tab = "home" | "countries" | "profile";

const categories: { name: Category; icon: string; color: string }[] = [
  { name: "Logement", icon: "🏠", color: "bg-[#ef6a2e]" },
  { name: "Nourriture", icon: "🍜", color: "bg-[#f5b942]" },
  { name: "Transport", icon: "🚌", color: "bg-[#57a773]" },
  { name: "Activités", icon: "📷", color: "bg-[#3c91c9]" },
  { name: "Shopping", icon: "🛍️", color: "bg-[#a76ccf]" },
  { name: "Santé", icon: "💊", color: "bg-[#df4d4d]" },
  { name: "Extras", icon: "✨", color: "bg-[#99F8FF]" },
];

const defaultCountries: Country[] = [
  {
    id: 1,
    name: "Thaïlande",
    flag: "🇹🇭",
    budget: 3000,
    imageUrl:
      "https://images.unsplash.com/photo-1528181304800-259b08848526?auto=format&fit=crop&w=500&q=80",
    startDate: "2026-03-01",
    endDate: null,
    closed: false,
    expenses: [
      { id: 1, category: "Logement", amount: 900 },
      { id: 2, category: "Nourriture", amount: 650 },
      { id: 3, category: "Transport", amount: 480 },
      { id: 4, category: "Activités", amount: 520 },
    ],
  },
];

function App() {
  const [activeTab, setActiveTab] = useState<Tab>("home");
  const [selectedCountryId, setSelectedCountryId] = useState<number | null>(
    null
  );


  const [userName, setUserName] = useState(() => {
  return localStorage.getItem("tbt-user-name") || "Ludo";
});

const [profileImage, setProfileImage] = useState(() => {
  return localStorage.getItem("tbt-profile-image") || "";
});

  const [budgetTotal, setBudgetTotal] = useState<number>(() => {
    const saved = localStorage.getItem("tbt-budget-total");
    return saved ? Number(saved) : 24000;
  });

  const [countries, setCountries] = useState<Country[]>(() => {
    const saved = localStorage.getItem("tbt-countries");

    try {
      if (!saved) return defaultCountries;

      const parsed = JSON.parse(saved) as Partial<Country>[];

      return parsed.map((country) => ({
        id: country.id || Date.now(),
        name: country.name || "Pays",
        flag: country.flag || "🌍",
        budget: country.budget || 0,
        imageUrl: country.imageUrl || "",
        startDate: country.startDate || new Date().toISOString().split("T")[0],
        endDate: country.endDate || null,
        expenses: country.expenses || [],
        closed: country.closed || false,
      }));
    } catch {
      return defaultCountries;
    }
  });

  const [countryName, setCountryName] = useState("");
  const [countryBudget, setCountryBudget] = useState("");
  const [countryFlag, setCountryFlag] = useState("🌍");
  const [countryImageUrl, setCountryImageUrl] = useState("");
  const [countryStartDate, setCountryStartDate] = useState("");

  const [expenseAmounts, setExpenseAmounts] = useState<Record<number, string>>(
    {}
  );

  const [expenseCategories, setExpenseCategories] = useState<
    Record<number, Category>
  >({});

  useEffect(() => {
    localStorage.setItem("tbt-budget-total", String(budgetTotal));
  }, [budgetTotal]);

  useEffect(() => {
    localStorage.setItem("tbt-countries", JSON.stringify(countries));
  }, [countries]);


  useEffect(() => {
  localStorage.setItem("tbt-user-name", userName);
}, [userName]);

useEffect(() => {
  localStorage.setItem("tbt-profile-image", profileImage);
}, [profileImage]);
  const getToday = () => new Date().toISOString().split("T")[0];

  const getDaysBetweenDates = (startDate: string, endDate: string | null) => {
    if (!startDate) return 0;

    const start = new Date(startDate);
    const end = new Date(endDate || getToday());
    const diffTime = end.getTime() - start.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

    return diffDays > 0 ? diffDays : 1;
  };

  const formatDate = (date: string | null) => {
    if (!date) return "En cours";

    return new Date(date).toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const spent = countries.reduce(
    (total, country) =>
      total + country.expenses.reduce((sum, expense) => sum + expense.amount, 0),
    0
  );

  const remaining = budgetTotal - spent;
  const projectedTotal = Math.round(spent * 1.8);

  const projectedPercent =
    budgetTotal > 0 ? Math.round((projectedTotal / budgetTotal) * 100) : 0;

  const allTravelDays = countries.reduce((total, country) => {
    return total + getDaysBetweenDates(country.startDate, country.endDate);
  }, 0);

  const globalDailyAverage =
    allTravelDays > 0 ? Math.round(spent / allTravelDays) : 0;

  const remainingDaysEstimate = 180;

  const remainingBudgetPerDay =
    remainingDaysEstimate > 0 ? Math.round(remaining / remainingDaysEstimate) : 0;

  const countriesWithDaily: CountryWithDaily[] = countries.map((country) => {
    const total = country.expenses.reduce(
      (sum, expense) => sum + expense.amount,
      0
    );

    const days = getDaysBetweenDates(country.startDate, country.endDate);
    const daily = days > 0 ? Math.round(total / days) : 0;

    return {
      ...country,
      total,
      days,
      daily,
    };
  });

  const mostExpensiveCountry = countriesWithDaily.reduce<CountryWithDaily | null>(
    (highest, country) => {
      if (!highest || country.daily > highest.daily) return country;
      return highest;
    },
    null
  );

  const plannedDailyGlobal =
    allTravelDays > 0 ? Math.round(budgetTotal / allTravelDays) : 0;

  const rhythmDifference = plannedDailyGlobal - globalDailyAverage;

  const budgetScore: BudgetScore =
    projectedPercent <= 70
      ? { label: "Excellent", color: "text-green-700", score: 86, stars: 4 }
      : projectedPercent <= 90
      ? { label: "Correct", color: "text-amber-600", score: 72, stars: 3 }
      : projectedPercent <= 100
      ? { label: "Attention", color: "text-orange-600", score: 58, stars: 2 }
      : { label: "Dépassement", color: "text-red-600", score: 35, stars: 1 };

  const getCategoryTotal = (category: Category) => {
    return countries.reduce((total, country) => {
      const categoryTotal = country.expenses
        .filter((expense) => expense.category === category)
        .reduce((sum, expense) => sum + expense.amount, 0);

      return total + categoryTotal;
    }, 0);
  };

  const addCountry = () => {
    const budget = Number(countryBudget);
    if (!countryName || !budget || !countryStartDate) return;

    const newCountry: Country = {
      id: Date.now(),
      name: countryName,
      flag: countryFlag || "🌍",
      budget,
      imageUrl:
        countryImageUrl ||
        "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=500&q=80",
      startDate: countryStartDate,
      endDate: null,
      expenses: [],
      closed: false,
    };

    setCountries((previousCountries) => [...previousCountries, newCountry]);
    setCountryName("");
    setCountryBudget("");
    setCountryFlag("🌍");
    setCountryImageUrl("");
    setCountryStartDate("");
    setSelectedCountryId(newCountry.id);
    setActiveTab("countries");
  };

  const addExpenseToCountry = (countryId: number) => {
    const amount = Number(expenseAmounts[countryId]);
    const category = expenseCategories[countryId] || "Logement";
    if (!amount) return;

    setCountries((previousCountries) =>
      previousCountries.map((country) =>
        country.id === countryId
          ? {
              ...country,
              expenses: [
                ...country.expenses,
                {
                  id: Date.now(),
                  amount,
                  category,
                },
              ],
            }
          : country
      )
    );

    setExpenseAmounts((previousAmounts) => ({
      ...previousAmounts,
      [countryId]: "",
    }));
  };

  const deleteExpense = (countryId: number, expenseId: number) => {
    const confirmed = window.confirm("Supprimer cette dépense ?");
    if (!confirmed) return;

    setCountries((previousCountries) =>
      previousCountries.map((country) =>
        country.id === countryId
          ? {
              ...country,
              expenses: country.expenses.filter(
                (expense) => expense.id !== expenseId
              ),
            }
          : country
      )
    );
  };

  const closeCountry = (countryId: number) => {
    setCountries((previousCountries) =>
      previousCountries.map((country) =>
        country.id === countryId
          ? {
              ...country,
              closed: true,
              endDate: getToday(),
            }
          : country
      )
    );
  };

  const deleteCountry = (countryId: number) => {
    const confirmed = window.confirm(
      "Supprimer ce pays et toutes ses dépenses ?"
    );

    if (!confirmed) return;

    setCountries((previousCountries) =>
      previousCountries.filter((country) => country.id !== countryId)
    );

    if (selectedCountryId === countryId) {
      setSelectedCountryId(null);
    }
  };

  const resetApp = () => {
    localStorage.removeItem("tbt-budget-total");
    localStorage.removeItem("tbt-countries");
    setBudgetTotal(24000);
    setCountries(defaultCountries);
    setSelectedCountryId(null);
    setActiveTab("home");
  };

  return (
    <div className="min-h-screen bg-[#f7efe6] text-[#142536]">
      <div className="mx-auto max-w-md px-4 pb-28 pt-4">
        <Header />

        {activeTab === "home" && (
          <>
<WelcomeCard userName={userName} profileImage={profileImage} />

            <section className="mb-4 grid grid-cols-4 gap-2">
              <StatCard
                icon="💳"
                label="Budget total"
                value={`${budgetTotal.toLocaleString("fr-FR")} €`}
                color="text-green-700"
                bar="bg-green-600"
              />
              <StatCard
                icon="📊"
                label="Dépensé"
                value={`${spent.toLocaleString("fr-FR")} €`}
                color="text-[#ef6a2e]"
                bar="bg-[#ef6a2e]"
              />
              <StatCard
                icon="👛"
                label="Restant"
                value={`${remaining.toLocaleString("fr-FR")} €`}
                color="text-sky-700"
                bar="bg-sky-600"
              />
              <StatCard
                icon="🗓️"
                label="Pays"
                value={`${countries.length}`}
                color="text-amber-700"
                bar="bg-amber-500"
              />
            </section>

            <SmartStats
              globalDailyAverage={globalDailyAverage}
              remainingBudgetPerDay={remainingBudgetPerDay}
              mostExpensiveCountry={mostExpensiveCountry}
              rhythmDifference={rhythmDifference}
              budgetScore={budgetScore}
              projectedPercent={projectedPercent}
              allTravelDays={allTravelDays}
            />

            <section className="mb-4 rounded-[30px] border border-[#ead6c1] bg-[#fffaf4] p-5 shadow-sm">
              <h2 className="mb-3 text-xl font-extrabold">Budget de base</h2>

              <input
                type="number"
                value={budgetTotal}
                onChange={(event) => setBudgetTotal(Number(event.target.value))}
                className="w-full rounded-xl border border-[#ead6c1] bg-white px-3 py-2 outline-none"
              />
            </section>

            <ProjectionCard
              projectedTotal={projectedTotal}
              projectedPercent={projectedPercent}
              budgetTotal={budgetTotal}
            />

            <ExpensesScreen spent={spent} getCategoryTotal={getCategoryTotal} />

            <CountriesPreview
              countries={countries}
              getDaysBetweenDates={getDaysBetweenDates}
              onSelectCountry={(countryId) => {
                setSelectedCountryId(countryId);
                setActiveTab("countries");
              }}
            />
          </>
        )}

        {activeTab === "countries" && (
          <CountriesScreen
            countries={countries}
            selectedCountryId={selectedCountryId}
            setSelectedCountryId={setSelectedCountryId}
            countryName={countryName}
            countryBudget={countryBudget}
            countryFlag={countryFlag}
            countryImageUrl={countryImageUrl}
            countryStartDate={countryStartDate}
            expenseAmounts={expenseAmounts}
            expenseCategories={expenseCategories}
            setCountryName={setCountryName}
            setCountryBudget={setCountryBudget}
            setCountryFlag={setCountryFlag}
            setCountryImageUrl={setCountryImageUrl}
            setCountryStartDate={setCountryStartDate}
            setExpenseAmounts={setExpenseAmounts}
            setExpenseCategories={setExpenseCategories}
            addCountry={addCountry}
            addExpenseToCountry={addExpenseToCountry}
            deleteExpense={deleteExpense}
            closeCountry={closeCountry}
            deleteCountry={deleteCountry}
            getDaysBetweenDates={getDaysBetweenDates}
            formatDate={formatDate}
          />
        )}

{activeTab === "profile" && (
  <ProfileScreen
    userName={userName}
    setUserName={setUserName}
    profileImage={profileImage}
    setProfileImage={setProfileImage}
    budgetTotal={budgetTotal}
    setBudgetTotal={setBudgetTotal}
    resetApp={resetApp}
  />
)}      </div>

      <BottomNav
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        setSelectedCountryId={setSelectedCountryId}
      />
    </div>
  );
}

function SmartStats({
  globalDailyAverage,
  remainingBudgetPerDay,
  mostExpensiveCountry,
  rhythmDifference,
  budgetScore,
  projectedPercent,
  allTravelDays,
}: {
  globalDailyAverage: number;
  remainingBudgetPerDay: number;
  mostExpensiveCountry: CountryWithDaily | null;
  rhythmDifference: number;
  budgetScore: BudgetScore;
  projectedPercent: number;
  allTravelDays: number;
}) {
  const safePercent = Math.min(projectedPercent, 100);

  return (
    <section className="mb-4 rounded-[30px] border border-[#ead6c1] bg-[#fffaf4] p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-extrabold">🧠 Stats intelligentes</h2>

        <span className="rounded-full bg-[#fff3e8] px-3 py-1 text-xs font-bold text-[#ef6a2e]">
          5 insights
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <InsightCard
          title="Moyenne / jour"
          value={`${globalDailyAverage.toLocaleString("fr-FR")} €`}
          subtitle={`${allTravelDays} jours analysés`}
          icon="📈"
          tone="orange"
        />

        <InsightCard
          title="Restant / jour"
          value={`${remainingBudgetPerDay.toLocaleString("fr-FR")} €`}
          subtitle="Pour rester dans le budget"
          icon="💳"
          tone="green"
        />

        <InsightCard
          title="Pays le plus cher"
          value={
            mostExpensiveCountry
              ? mostExpensiveCountry.name
              : "Aucun pays"
          }
          subtitle={
            mostExpensiveCountry
              ? `${mostExpensiveCountry.daily.toLocaleString("fr-FR")} € / jour`
              : "Ajoute une dépense"
          }
          icon={mostExpensiveCountry?.flag || "🌍"}
          tone="purple"
        />

        <InsightCard
          title="Alerte budget"
          value={
            rhythmDifference >= 0
              ? `${rhythmDifference.toLocaleString("fr-FR")} €`
              : `${Math.abs(rhythmDifference).toLocaleString("fr-FR")} €`
          }
          subtitle={rhythmDifference >= 0 ? "sous ton rythme" : "au-dessus"}
          icon={rhythmDifference >= 0 ? "✅" : "⚠️"}
          tone={rhythmDifference >= 0 ? "green" : "red"}
        />

        <div className="col-span-2 rounded-[26px] border-2 border-[#f3d79c] bg-gradient-to-br from-[#fffaf1] to-[#fff4d8] p-4 shadow-[0_12px_30px_rgba(145,100,40,0.12)]">
          <div className="grid grid-cols-[86px_1fr] items-center gap-4">
            <div
              className="flex h-20 w-20 items-center justify-center rounded-full p-2 shadow-inner"
              style={{
                background: `conic-gradient(#58a65c ${safePercent}%, #eadfd5 ${safePercent}% 100%)`,
              }}
            >
              <div className="flex h-full w-full flex-col items-center justify-center rounded-full bg-[#fffaf4]">
                <strong className="text-xl">{budgetScore.score}</strong>
                <span className="text-xs">/100</span>
              </div>
            </div>

            <div>
              <p className="text-sm font-bold text-[#8b7969]">
                Score budget
              </p>

              <p className={`text-xl font-extrabold ${budgetScore.color}`}>
                {budgetScore.label}
              </p>

              <p className="text-sm text-[#7d6b5c]">
                Gestion actuelle du budget.
              </p>

              <p className="mt-1 text-xl text-[#f5b942]">
                {"★".repeat(budgetScore.stars)}
                <span className="text-[#e6d6c6]">
                  {"★".repeat(5 - budgetScore.stars)}
                </span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function InsightCard({
  title,
  value,
  subtitle,
  icon,
  tone,
}: {
  title: string;
  value: string;
  subtitle: string;
  icon: string;
  tone: "orange" | "green" | "purple" | "red";
}) {
  const styles = {
    orange: {
      border: "border-[#ef6a2e]",
      bg: "from-[#fffaf4] to-[#fff0df]",
      iconBg: "bg-[#ffe0bd]",
      iconText: "text-[#ef6a2e]",
      value: "text-[#ef6a2e]",
      pill: "bg-[#fff1e6] text-[#9b4f21]",
    },
    green: {
      border: "border-green-500",
      bg: "from-[#fffaf4] to-[#eaf8ee]",
      iconBg: "bg-green-100",
      iconText: "text-green-700",
      value: "text-green-700",
      pill: "bg-green-50 text-green-700",
    },
    purple: {
      border: "border-purple-500",
      bg: "from-[#fffaf4] to-[#f3e9ff]",
      iconBg: "bg-purple-100",
      iconText: "text-purple-700",
      value: "text-purple-700",
      pill: "bg-purple-50 text-purple-700",
    },
    red: {
      border: "border-red-500",
      bg: "from-[#fffaf4] to-[#ffe9e9]",
      iconBg: "bg-red-100",
      iconText: "text-red-600",
      value: "text-red-600",
      pill: "bg-red-50 text-red-600",
    },
  }[tone];

  return (
    <div
      className={`relative min-h-[165px] overflow-hidden rounded-[26px] border-2 ${styles.border} bg-gradient-to-br ${styles.bg} p-4 shadow-[0_12px_30px_rgba(80,55,35,0.12)]`}
    >
      <div className="absolute -bottom-8 -right-8 h-24 w-24 rounded-full bg-white/40" />
      <div className="absolute right-3 top-3 grid grid-cols-3 gap-1 opacity-25">
        {Array.from({ length: 9 }).map((_, index) => (
          <span
            key={index}
            className="h-1 w-1 rounded-full bg-[#8b7969]"
          />
        ))}
      </div>

      <div
        className={`mb-3 flex h-12 w-12 items-center justify-center rounded-2xl ${styles.iconBg} text-2xl shadow-sm ${styles.iconText}`}
      >
        {icon}
      </div>

      <p className="text-[13px] font-extrabold leading-tight text-[#142536]">
        {title}
      </p>

      <p className={`mt-2 text-[24px] font-black leading-tight ${styles.value}`}>
        {value}
      </p>

      <div
        className={`mt-3 inline-flex rounded-full px-3 py-1 text-[11px] font-bold ${styles.pill}`}
      >
        {subtitle}
      </div>
    </div>
  );
}

function Header() {
  return (
    <header className="mb-5 flex flex-col items-center">
      <img
        src="/Logo.png"
        alt="Travel Budget Tracker"
        className="h-32 w-32 object-contain drop-shadow-md"
      />

      <div className="-mt-6 text-center">
        <p className="text-[24px] font-extrabold leading-none tracking-tight">
          Travel <span className="text-[#ef6a2e]">Budget</span>
        </p>
        <p className="mt-2 text-[15px] font-semibold leading-none tracking-[0.32em] text-[#8b7969]">
          TRACKER
        </p>
      </div>
    </header>
  );
}

function WelcomeCard({
  userName,
  profileImage,
}: {
  userName: string;
  profileImage: string;
}) {
  return (
    <section className="mb-4 overflow-hidden rounded-[30px] border border-[#ead6c1] bg-[#fffaf4] p-5 shadow-sm">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold">Bonjour {userName} ! 👋</h1>
          <p className="mt-1 text-sm text-[#7d6b5c]">
            Ton tour du monde continue !
          </p>
        </div>

        <div className="flex h-20 w-24 items-center justify-center overflow-hidden rounded-lg  border-2 border-[#ead6c1] bg-[#f9eadb]">
          {profileImage ? (
            <img
              src={profileImage}
              alt="Profil"
              className="h-full w-full object-contain p-1"
            />
          ) : (
            <span className="text-4xl">🎈</span>
          )}
        </div>
      </div>
    </section>
  );
}

function StatCard({
  icon,
  label,
  value,
  color,
  bar,
}: {
  icon: string;
  label: string;
  value: string;
  color: string;
  bar: string;
}) {
  return (
    <div className="rounded-[24px] border border-[#ead6c1] bg-[#fffaf4] p-3 text-center shadow-sm">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#f1eadf] text-xl">
        {icon}
      </div>

      <p className="min-h-[32px] text-[11px] font-semibold leading-tight text-[#312820]">
        {label}
      </p>

      <p className={`mt-1 text-base font-extrabold ${color}`}>{value}</p>

      <div className={`mx-auto mt-3 h-1 w-8 rounded-full ${bar}`} />
    </div>
  );
}

function ProjectionCard({
  projectedTotal,
  projectedPercent,
  budgetTotal,
}: {
  projectedTotal: number;
  projectedPercent: number;
  budgetTotal: number;
}) {
  const projectedDiff = budgetTotal - projectedTotal;
  const safePercent = Math.min(projectedPercent, 100);

  return (
    <section className="mb-4 rounded-[30px] border border-[#ead6c1] bg-[#fffaf4] p-5 shadow-sm">
      <h2 className="mb-5 text-xl font-extrabold">
        ✨ Projection de fin de voyage
      </h2>

      <div className="grid grid-cols-[1fr_112px] items-center gap-4">
        <div>
          <p className="text-sm text-[#7d6b5c]">Dépense totale estimée</p>

          <p className="mt-1 text-4xl font-extrabold">
            {projectedTotal.toLocaleString("fr-FR")} €
          </p>

          <p
            className={`mt-3 text-sm font-bold ${
              projectedDiff >= 0 ? "text-green-700" : "text-red-600"
            }`}
          >
            {projectedDiff >= 0
              ? `✅ Soit ${projectedDiff.toLocaleString(
                  "fr-FR"
                )} € sous le budget !`
              : `⚠️ ${Math.abs(projectedDiff).toLocaleString(
                  "fr-FR"
                )} € au-dessus du budget`}
          </p>
        </div>

        <div className="flex flex-col items-center">
          <div
            className="flex h-24 w-24 items-center justify-center rounded-full p-3"
            style={{
              background: `conic-gradient(#58a65c ${safePercent}%, #eadfd5 ${safePercent}% 100%)`,
            }}
          >
            <div className="flex h-full w-full items-center justify-center rounded-full bg-[#fffaf4]">
              <span className="text-2xl font-extrabold">{safePercent}%</span>
            </div>
          </div>

          <p className="mt-2 text-center text-xs text-[#7d6b5c]">
            du budget utilisé
          </p>
        </div>
      </div>

      <div className="mt-5 h-3 rounded-full bg-[#eadfd5]">
        <div
          className={`h-3 rounded-full ${
            projectedPercent > 100 ? "bg-red-500" : "bg-green-600"
          }`}
          style={{ width: `${safePercent}%` }}
        />
      </div>
    </section>
  );
}

function ExpensesScreen({
  spent,
  getCategoryTotal,
}: {
  spent: number;
  getCategoryTotal: (category: Category) => number;
}) {
  return (
    <section className="mb-4 rounded-[30px] border border-[#ead6c1] bg-[#fffaf4] p-5 shadow-sm">
      <h2 className="mb-4 text-xl font-extrabold">
        Répartition des dépenses
      </h2>

      <div className="grid grid-cols-[120px_1fr] items-center gap-4">
        <div className="flex aspect-square items-center justify-center rounded-full bg-[conic-gradient(#ef6a2e_0_36%,#f5b942_36%_60%,#57a773_60%_77%,#3c91c9_77%_91%,#a76ccf_91%_97%,#df4d4d_97%_99%,#99F8FF_99%_100%)] p-5">
          <div className="flex h-full w-full flex-col items-center justify-center rounded-full bg-[#fffaf4] text-center">
            <strong className="text-sm">
              {spent.toLocaleString("fr-FR")} €
            </strong>
            <span className="text-[10px] text-[#7d6b5c]">dépensés</span>
          </div>
        </div>

        <div className="space-y-2">
          {categories.map((category) => {
            const total = getCategoryTotal(category.name);
            const percent = spent > 0 ? Math.round((total / spent) * 100) : 0;

            return (
              <div
                key={category.name}
                className="grid grid-cols-[22px_1fr_auto_30px] items-center gap-2 text-sm"
              >
                <span
                  className={`h-2.5 w-2.5 rounded-full ${category.color}`}
                />

                <span className="truncate">
                  {category.icon} {category.name}
                </span>

                <span className="font-bold">
                  {total.toLocaleString("fr-FR")} €
                </span>

                <span className="text-right text-[#8b7969]">{percent}%</span>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function CountriesPreview({
  countries,
  onSelectCountry,
  getDaysBetweenDates,
}: {
  countries: Country[];
  onSelectCountry: (countryId: number) => void;
  getDaysBetweenDates: (startDate: string, endDate: string | null) => number;
}) {
  return (
    <section className="mb-4 rounded-[30px] border border-[#ead6c1] bg-[#fffaf4] p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-extrabold">Par pays / étape</h2>
        <span className="text-sm font-bold text-[#ef6a2e]">
          Voir tous les pays ›
        </span>
      </div>

      <div className="space-y-4">
        {countries.slice(0, 3).map((country) => {
          const total = country.expenses.reduce(
            (sum, expense) => sum + expense.amount,
            0
          );

          const percent = Math.round((total / country.budget) * 100 || 0);
          const days = getDaysBetweenDates(country.startDate, country.endDate);
          const realDaily = days > 0 ? Math.round(total / days) : 0;

          return (
            <button
              key={country.id}
              onClick={() => onSelectCountry(country.id)}
              className="w-full rounded-3xl bg-white p-3 text-left shadow-sm transition active:scale-[0.98]"
            >
              <CountryRow
                country={country}
                total={total}
                percent={percent}
                days={days}
                realDaily={realDaily}
              />
            </button>
          );
        })}
      </div>
    </section>
  );
}

function CountriesScreen({
  countries,
  selectedCountryId,
  setSelectedCountryId,
  countryName,
  countryBudget,
  countryFlag,
  countryImageUrl,
  countryStartDate,
  expenseAmounts,
  expenseCategories,
  setCountryName,
  setCountryBudget,
  setCountryFlag,
  setCountryImageUrl,
  setCountryStartDate,
  setExpenseAmounts,
  setExpenseCategories,
  addCountry,
  addExpenseToCountry,
  deleteExpense,
  closeCountry,
  deleteCountry,
  getDaysBetweenDates,
  formatDate,
}: {
  countries: Country[];
  selectedCountryId: number | null;
  setSelectedCountryId: Dispatch<SetStateAction<number | null>>;
  countryName: string;
  countryBudget: string;
  countryFlag: string;
  countryImageUrl: string;
  countryStartDate: string;
  expenseAmounts: Record<number, string>;
  expenseCategories: Record<number, Category>;
  setCountryName: (value: string) => void;
  setCountryBudget: (value: string) => void;
  setCountryFlag: (value: string) => void;
  setCountryImageUrl: (value: string) => void;
  setCountryStartDate: (value: string) => void;
  setExpenseAmounts: Dispatch<SetStateAction<Record<number, string>>>;
  setExpenseCategories: Dispatch<SetStateAction<Record<number, Category>>>;
  addCountry: () => void;
  addExpenseToCountry: (countryId: number) => void;
  deleteExpense: (countryId: number, expenseId: number) => void;
  closeCountry: (countryId: number) => void;
  deleteCountry: (countryId: number) => void;
  getDaysBetweenDates: (startDate: string, endDate: string | null) => number;
  formatDate: (date: string | null) => string;
}) {
  const activeCountries = countries.filter((country) => !country.closed);
  const closedCountries = countries.filter((country) => country.closed);

  return (
    <>
      <section className="mb-4 rounded-[30px] border border-[#ead6c1] bg-[#fffaf4] p-5 shadow-sm">
        <h2 className="mb-3 text-xl font-extrabold">Ajouter un pays</h2>

        <div className="grid grid-cols-[1fr_80px] gap-2">
          <input
            value={countryName}
            onChange={(event) => setCountryName(event.target.value)}
            placeholder="Pays"
            className="rounded-xl border border-[#ead6c1] bg-white px-3 py-2 outline-none"
          />

          <input
            value={countryFlag}
            onChange={(event) => setCountryFlag(event.target.value)}
            placeholder="🇯🇵"
            className="rounded-xl border border-[#ead6c1] bg-white px-3 py-2 outline-none"
          />
        </div>

        <input
          type="number"
          value={countryBudget}
          onChange={(event) => setCountryBudget(event.target.value)}
          placeholder="Budget prévu"
          className="mt-2 w-full rounded-xl border border-[#ead6c1] bg-white px-3 py-2 outline-none"
        />

        <label className="mt-3 block text-sm font-bold text-[#8b7969]">
          Date de début
        </label>

        <input
          type="date"
          value={countryStartDate}
          onChange={(event) => setCountryStartDate(event.target.value)}
          className="mt-1 w-full rounded-xl border border-[#ead6c1] bg-white px-3 py-2 outline-none"
        />

        <div className="mt-2">
          <label className="mb-1 block text-sm font-bold text-[#8b7969]">
            Photo du pays
          </label>

          <input
            type="file"
            accept="image/*"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (!file) return;

              const reader = new FileReader();
              reader.onloadend = () => {
                setCountryImageUrl(reader.result as string);
              };
              reader.readAsDataURL(file);
            }}
            className="w-full rounded-xl border border-[#ead6c1] bg-white px-3 py-2 text-sm outline-none"
          />

          {countryImageUrl && (
            <img
              src={countryImageUrl}
              alt="Aperçu du pays"
              className="mt-3 h-28 w-full rounded-xl object-cover"
            />
          )}
        </div>

        <button
          onClick={addCountry}
          className="mt-3 w-full rounded-xl bg-[#ef6a2e] py-3 font-extrabold text-white"
        >
          Créer l’étape
        </button>
      </section>

      <CountryGroup
        title="Pays en cours"
        emptyMessage="Aucun pays en cours pour le moment."
        countries={activeCountries}
        selectedCountryId={selectedCountryId}
        setSelectedCountryId={setSelectedCountryId}
        expenseAmounts={expenseAmounts}
        expenseCategories={expenseCategories}
        setExpenseAmounts={setExpenseAmounts}
        setExpenseCategories={setExpenseCategories}
        addExpenseToCountry={addExpenseToCountry}
        deleteExpense={deleteExpense}
        closeCountry={closeCountry}
        deleteCountry={deleteCountry}
        getDaysBetweenDates={getDaysBetweenDates}
        formatDate={formatDate}
        canEdit
      />

      <CountryGroup
        title="Pays terminés"
        emptyMessage="Aucun pays terminé pour le moment."
        countries={closedCountries}
        selectedCountryId={selectedCountryId}
        setSelectedCountryId={setSelectedCountryId}
        expenseAmounts={expenseAmounts}
        expenseCategories={expenseCategories}
        setExpenseAmounts={setExpenseAmounts}
        setExpenseCategories={setExpenseCategories}
        addExpenseToCountry={addExpenseToCountry}
        deleteExpense={deleteExpense}
        closeCountry={closeCountry}
        deleteCountry={deleteCountry}
        getDaysBetweenDates={getDaysBetweenDates}
        formatDate={formatDate}
        canEdit={false}
      />
    </>
  );
}

function CountryGroup({
  title,
  emptyMessage,
  countries,
  selectedCountryId,
  setSelectedCountryId,
  expenseAmounts,
  expenseCategories,
  setExpenseAmounts,
  setExpenseCategories,
  addExpenseToCountry,
  deleteExpense,
  closeCountry,
  deleteCountry,
  getDaysBetweenDates,
  formatDate,
  canEdit,
}: {
  title: string;
  emptyMessage: string;
  countries: Country[];
  selectedCountryId: number | null;
  setSelectedCountryId: Dispatch<SetStateAction<number | null>>;
  expenseAmounts: Record<number, string>;
  expenseCategories: Record<number, Category>;
  setExpenseAmounts: Dispatch<SetStateAction<Record<number, string>>>;
  setExpenseCategories: Dispatch<SetStateAction<Record<number, Category>>>;
  addExpenseToCountry: (countryId: number) => void;
  deleteExpense: (countryId: number, expenseId: number) => void;
  closeCountry: (countryId: number) => void;
  deleteCountry: (countryId: number) => void;
  getDaysBetweenDates: (startDate: string, endDate: string | null) => number;
  formatDate: (date: string | null) => string;
  canEdit: boolean;
}) {
  return (
    <section className="mb-4 rounded-[30px] border border-[#ead6c1] bg-[#fffaf4] p-5 shadow-sm">
      <h2 className="mb-4 text-xl font-extrabold">{title}</h2>

      {countries.length === 0 && (
        <p className="text-sm text-[#8b7969]">{emptyMessage}</p>
      )}

      <div className="space-y-5">
        {countries.map((country) => {
          const total = country.expenses.reduce(
            (sum, expense) => sum + expense.amount,
            0
          );

          const percent = Math.round((total / country.budget) * 100 || 0);
          const isSelected = selectedCountryId === country.id;
          const days = getDaysBetweenDates(country.startDate, country.endDate);
          const realDaily = days > 0 ? Math.round(total / days) : 0;
          const plannedDaily =
            days > 0 ? Math.round(country.budget / days) : 0;
          const isOverBudget = total > country.budget;
          const finalDiff = country.budget - total;

          return (
            <CountryCard
              key={country.id}
              country={country}
              total={total}
              percent={percent}
              isSelected={isSelected}
              days={days}
              realDaily={realDaily}
              plannedDaily={plannedDaily}
              isOverBudget={isOverBudget}
              setSelectedCountryId={setSelectedCountryId}
              expenseAmounts={expenseAmounts}
              expenseCategories={expenseCategories}
              setExpenseAmounts={setExpenseAmounts}
              setExpenseCategories={setExpenseCategories}
              addExpenseToCountry={addExpenseToCountry}
              deleteExpense={deleteExpense}
              closeCountry={closeCountry}
              deleteCountry={deleteCountry}
              formatDate={formatDate}
              canEdit={canEdit}
              finalDiff={finalDiff}
            />
          );
        })}
      </div>
    </section>
  );
}

function CountryCard({
  country,
  total,
  percent,
  isSelected,
  days,
  realDaily,
  plannedDaily,
  isOverBudget,
  setSelectedCountryId,
  expenseAmounts,
  expenseCategories,
  setExpenseAmounts,
  setExpenseCategories,
  addExpenseToCountry,
  deleteExpense,
  closeCountry,
  deleteCountry,
  formatDate,
  canEdit,
  finalDiff,
}: {
  country: Country;
  total: number;
  percent: number;
  isSelected: boolean;
  days: number;
  realDaily: number;
  plannedDaily: number;
  isOverBudget: boolean;
  setSelectedCountryId: Dispatch<SetStateAction<number | null>>;
  expenseAmounts: Record<number, string>;
  expenseCategories: Record<number, Category>;
  setExpenseAmounts: Dispatch<SetStateAction<Record<number, string>>>;
  setExpenseCategories: Dispatch<SetStateAction<Record<number, Category>>>;
  addExpenseToCountry: (countryId: number) => void;
  deleteExpense: (countryId: number, expenseId: number) => void;
  closeCountry: (countryId: number) => void;
  deleteCountry: (countryId: number) => void;
  formatDate: (date: string | null) => string;
  canEdit: boolean;
  finalDiff?: number;
}) {
  return (
    <div
      onClick={() => setSelectedCountryId(isSelected ? null : country.id)}
      className={`cursor-pointer transition active:scale-[0.98] ${
        isSelected
          ? "rounded-3xl bg-[#fff3e8] p-3 ring-2 ring-[#ef6a2e] shadow-md"
          : "border-t border-[#ead6c1] pt-4 first:border-t-0 first:pt-0"
      }`}
    >
      <CountryRow
        country={country}
        total={total}
        percent={percent}
        days={days}
        realDaily={realDaily}
      />

      {isSelected && (
        <>
          <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
            <InfoBox
              label="Période"
              value={`${formatDate(country.startDate)} → ${formatDate(
                country.endDate
              )}`}
            />
            <InfoBox label="Durée" value={`${days} jours`} />
            <InfoBox
              label="Prévu / jour"
              value={`${plannedDaily.toLocaleString("fr-FR")} €`}
            />
            <InfoBox
              label="Réel / jour"
              value={`${realDaily.toLocaleString("fr-FR")} €`}
            />
          </div>

          {isOverBudget && (
            <div className="mt-3 rounded-2xl bg-red-50 p-3 text-sm font-bold text-red-600">
              ⚠️ Ce pays dépasse son budget prévu.
            </div>
          )}

          {!canEdit && typeof finalDiff === "number" && (
            <div
              className={`mt-3 rounded-2xl p-3 text-sm font-bold ${
                finalDiff >= 0
                  ? "bg-green-50 text-green-700"
                  : "bg-red-50 text-red-600"
              }`}
            >
              {finalDiff >= 0
                ? `✅ Pays terminé avec ${finalDiff.toLocaleString(
                    "fr-FR"
                  )} € économisés.`
                : `⚠️ Pays terminé avec ${Math.abs(finalDiff).toLocaleString(
                    "fr-FR"
                  )} € de dépassement.`}
            </div>
          )}

          <div className="mt-4 rounded-2xl bg-[#fffaf4] p-3">
            <p className="mb-2 text-sm font-bold text-[#9b5e38]">
              Dépenses enregistrées
            </p>

            {country.expenses.length === 0 ? (
              <p className="text-xs text-[#8b7969]">
                Aucune dépense ajoutée pour ce pays.
              </p>
            ) : (
              <div className="space-y-2">
                {country.expenses.map((expense) => {
                  const category = categories.find(
                    (item) => item.name === expense.category
                  );

                  return (
                    <div
                      key={expense.id}
                      className="flex items-center justify-between rounded-xl bg-[#fdf6f0] px-3 py-2 text-sm"
                    >
                      <span>
                        {category?.icon || "💸"} {expense.category}
                      </span>

                      <div className="flex items-center gap-2">
                        <strong>
                          {expense.amount.toLocaleString("fr-FR")} €
                        </strong>

                        {canEdit && !country.closed && (
                          <button
                            onClick={(event) => {
                              event.stopPropagation();
                              deleteExpense(country.id, expense.id);
                            }}
                            className="rounded-full bg-red-50 px-2 py-1 text-xs font-bold text-red-600"
                          >
                            ×
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {canEdit && !country.closed && (
            <>
              <p className="mt-3 text-sm font-semibold text-[#9b5e38]">
                Ajouter une dépense à {country.name}
              </p>

              <div className="mt-2 grid grid-cols-[1fr_1fr_44px] gap-2">
                <input
                  type="number"
                  value={expenseAmounts[country.id] || ""}
                  onClick={(event) => event.stopPropagation()}
                  onChange={(event) =>
                    setExpenseAmounts((previousAmounts) => ({
                      ...previousAmounts,
                      [country.id]: event.target.value,
                    }))
                  }
                  placeholder="Montant"
                  className="rounded-xl border border-[#ead6c1] bg-white px-3 py-2 text-sm outline-none"
                />

                <select
                  value={expenseCategories[country.id] || "Logement"}
                  onClick={(event) => event.stopPropagation()}
                  onChange={(event) =>
                    setExpenseCategories((previousCategories) => ({
                      ...previousCategories,
                      [country.id]: event.target.value as Category,
                    }))
                  }
                  className="rounded-xl border border-[#ead6c1] bg-white px-3 py-2 text-sm outline-none"
                >
                  {categories.map((category) => (
                    <option key={category.name} value={category.name}>
                      {category.name}
                    </option>
                  ))}
                </select>

                <button
                  onClick={(event) => {
                    event.stopPropagation();
                    addExpenseToCountry(country.id);
                  }}
                  className="rounded-xl bg-[#ef6a2e] text-xl font-extrabold text-white"
                >
                  +
                </button>
              </div>
            </>
          )}

          <div className="mt-3 flex justify-between gap-2">
            <button
              onClick={(event) => {
                event.stopPropagation();
                deleteCountry(country.id);
              }}
              className="rounded-full bg-red-50 px-3 py-1 text-xs font-bold text-red-600"
            >
              Supprimer le pays
            </button>

            {country.closed ? (
              <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-bold text-green-700">
                Pays terminé
              </span>
            ) : (
              <button
                onClick={(event) => {
                  event.stopPropagation();
                  closeCountry(country.id);
                }}
                className="rounded-full bg-[#f3e2d4] px-3 py-1 text-xs font-bold text-[#9b5e38]"
              >
                Terminer ce pays
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function InfoBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-[#fdf6f0] p-3">
      <p className="text-xs text-[#8b7969]">{label}</p>
      <p className="font-bold">{value}</p>
    </div>
  );
}

function CountryRow({
  country,
  total,
  percent,
  days,
  realDaily,
}: {
  country: Country;
  total: number;
  percent: number;
  days: number;
  realDaily: number;
}) {
  return (
    <div className="flex gap-3">
      <div className="h-20 w-20 shrink-0 overflow-hidden rounded-2xl bg-[#f1eadf]">
        {country.imageUrl ? (
          <img
            src={country.imageUrl}
            alt={country.name}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-3xl">
            {country.flag}
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex justify-between gap-3">
          <div>
            <h3 className="text-lg font-extrabold">
              {country.name} {country.flag}
            </h3>

            <p className="text-sm text-[#8b7969]">
              {country.closed ? "Terminé" : "En cours"} · {days} jours
            </p>

            <p className="text-xs text-[#8b7969]">
              {realDaily.toLocaleString("fr-FR")} €/jour
            </p>
          </div>

          <div className="text-right">
            <p className="font-extrabold">
              {total.toLocaleString("fr-FR")} €
            </p>

            <p className="text-xs text-[#8b7969]">
              / {country.budget.toLocaleString("fr-FR")} €
            </p>
          </div>
        </div>

        <div className="mt-3 flex items-center gap-2">
          <div className="h-2 flex-1 rounded-full bg-[#eadfd5]">
            <div
              className={`h-2 rounded-full ${
                percent > 100 ? "bg-red-500" : "bg-[#ef6a2e]"
              }`}
              style={{ width: `${Math.min(percent, 100)}%` }}
            />
          </div>

          <span
            className={`text-sm font-extrabold ${
              percent > 100 ? "text-red-500" : "text-[#ef6a2e]"
            }`}
          >
            {percent}%
          </span>
        </div>
      </div>
    </div>
  );
}

function ProfileScreen({
  userName,
  setUserName,
  profileImage,
  setProfileImage,
  budgetTotal,
  setBudgetTotal,
  resetApp,
}: {
  userName: string;
  setUserName: (value: string) => void;
  profileImage: string;
  setProfileImage: (value: string) => void;
  budgetTotal: number;
  setBudgetTotal: (value: number) => void;
  resetApp: () => void;
}) {
  return (
    <>
      <section className="mb-4 rounded-[30px] border border-[#ead6c1] bg-[#fffaf4] p-5 shadow-sm">
        <h2 className="mb-4 text-xl font-extrabold">Profil utilisateur</h2>

        <div className="mb-4 flex items-center gap-4">
          <div className="flex h-24 w-24 items-center justify-center overflow-visible rounded-3xl bg-[#f9eadb]">
            {profileImage ? (
              <img
                src={profileImage}
                alt="Profil"
                className="h-full w-full object-contain"
              />
            ) : (
              <span className="text-4xl">🎈</span>
            )}
          </div>

          <label className="cursor-pointer rounded-full bg-[#ef6a2e] px-4 py-2 text-sm font-extrabold text-white">
            Changer
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (!file) return;

                const reader = new FileReader();
                reader.onloadend = () => {
                  setProfileImage(reader.result as string);
                };
                reader.readAsDataURL(file);
              }}
            />
          </label>
        </div>

        <label className="mb-1 block text-sm font-bold text-[#8b7969]">
          Prénom
        </label>

        <input
          value={userName}
          onChange={(event) => setUserName(event.target.value)}
          className="mb-4 w-full rounded-xl border border-[#ead6c1] bg-white px-3 py-2 outline-none"
        />

        <label className="mb-1 block text-sm font-bold text-[#8b7969]">
          Budget total
        </label>

        <input
          type="number"
          value={budgetTotal}
          onChange={(event) => setBudgetTotal(Number(event.target.value))}
          className="w-full rounded-xl border border-[#ead6c1] bg-white px-3 py-2 outline-none"
        />
      </section>

      <section className="mb-4 rounded-[30px] border border-red-200 bg-red-50 p-5 shadow-sm">
        <h2 className="mb-2 text-xl font-extrabold text-red-700">
          Zone danger
        </h2>

        <button
          onClick={resetApp}
          className="w-full rounded-xl bg-red-600 py-3 font-extrabold text-white"
        >
          Réinitialiser l’app
        </button>
      </section>
    </>
  );
}

function BottomNav({
  activeTab,
  setActiveTab,
  setSelectedCountryId,
}: {
  activeTab: Tab;
  setActiveTab: Dispatch<SetStateAction<Tab>>;
  setSelectedCountryId: Dispatch<SetStateAction<number | null>>;
}) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 mx-auto max-w-md px-4 pb-4">
      <div className="rounded-[28px] border border-[#ead6c1] bg-[#fffaf4]/95 px-6 py-3 shadow-lg backdrop-blur">
        <div className="grid grid-cols-4 items-center text-xs font-bold">
          <button
            onClick={() => {
              setActiveTab("home");
              setSelectedCountryId(null);
            }}
            className={`flex flex-col items-center justify-center rounded-xl px-2 py-1 transition active:scale-[0.95] ${
              activeTab === "home" ? "text-[#ef6a2e]" : "text-[#8b7969]"
            }`}
          >
            <span className="text-xl">🏠</span>
            Accueil
          </button>

          <button
            onClick={() => {
              setActiveTab("countries");
            }}
            className={`flex flex-col items-center justify-center rounded-xl px-2 py-1 transition active:scale-[0.95] ${
              activeTab === "countries" ? "text-[#ef6a2e]" : "text-[#8b7969]"
            }`}
          >
            <span className="text-xl">🌍</span>
            Pays
          </button>

          <button
            onClick={() => {
              setSelectedCountryId(null);
              setActiveTab("countries");
            }}
            className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#ef6a2e] text-3xl font-light leading-none text-white shadow-md transition active:scale-95"
          >
            +
          </button>

          <button
            onClick={() => {
            setActiveTab("profile");
              setSelectedCountryId(null);
            }}
            className={`flex flex-col items-center justify-center rounded-xl px-2 py-1 transition active:scale-[0.95] ${
              activeTab === "profile" ? "text-[#ef6a2e]" : "text-[#8b7969]"
            }`}
          >
            <span className="text-xl">⚙️</span>
            Profile
          </button>
        </div>
      </div>
    </nav>
  );
}

export default App;