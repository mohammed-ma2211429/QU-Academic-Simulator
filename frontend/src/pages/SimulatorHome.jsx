import {
  Activity, AlertTriangle, ArrowRight, Bot, CheckCircle2, Database,
  FileDown, Lightbulb, Route, SlidersHorizontal, Sparkles, TrendingUp,
} from "lucide-react";
import { Link } from "../components/AppLink";

const SIMULATORS = [
  {
    title: "Cohort Flow",
    route: "/cohort",
    icon: Route,
    eyebrow: "Student progression",
    question: "How will students move through the degree over time?",
    description: "Follow an existing student population and future intakes term by term through prerequisites, course seats, passing, delay, graduation, and withdrawal.",
    outputs: ["Roadmap flow", "Term progression", "Completion outcomes"],
    accent: "maroon",
  },
  {
    title: "Bottleneck Analysis",
    route: "/bottleneck",
    icon: AlertTriangle,
    eyebrow: "Capacity pressure",
    question: "Which courses create the greatest risk of delay?",
    description: "Stress course capacity, compare the effect against a baseline, and identify where an added section or protected capacity could matter most.",
    outputs: ["Ranked bottlenecks", "Delay impact", "Course what-if"],
    accent: "amber",
  },
  {
    title: "Monte Carlo",
    route: "/monte-carlo",
    icon: Activity,
    eyebrow: "Outcome uncertainty",
    question: "How reliable is a result when pass rates vary?",
    description: "Repeat the cohort model across many plausible pass-rate outcomes to see the range of graduation results instead of relying on one deterministic run.",
    outputs: ["Outcome range", "Percentiles", "Sensitivity"],
    accent: "green",
  },
  {
    title: "Enrollment Forecast",
    route: "/enrollment-forecast",
    icon: TrendingUp,
    eyebrow: "Future demand",
    question: "When could enrollment growth exceed current capacity?",
    description: "Project program enrollment under a chosen growth model and surface the courses likely to reach their current seat limits first.",
    outputs: ["Growth projection", "Capacity signals", "Demand method"],
    accent: "blue",
  },
];

const WORKFLOW = [
  {
    number: "01",
    icon: Lightbulb,
    title: "Start with a decision",
    text: "Choose the planning question you need to answer—not a chart you want to produce.",
  },
  {
    number: "02",
    icon: SlidersHorizontal,
    title: "Set the conditions",
    text: "Select a program, review the defaults, then change only the inputs relevant to your question.",
  },
  {
    number: "03",
    icon: CheckCircle2,
    title: "Interpret the evidence",
    text: "Compare the outcome with the baseline, inspect the cause, and export the result for discussion.",
  },
];

const QUESTIONS = [
  "Where should we add a new section?",
  "What happens if the next intake grows?",
  "Which course creates the most downstream delay?",
  "How sensitive is graduation time to pass rates?",
];

export default function SimulatorHome() {
  return (
    <div className="space-y-8 pb-3">
      <section className="simulator-home-hero px-5 py-7 text-white sm:px-8 sm:py-9 xl:px-11 xl:py-11">
        <div className="grid items-center gap-9 xl:grid-cols-[1.08fr_.92fr]">
          <div className="max-w-3xl">
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-[#eadfce]">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
              Academic planning simulation suite
            </div>
            <h2 className="mt-4 max-w-2xl text-[34px] font-bold leading-[1.06] tracking-[-0.045em] text-white sm:text-[44px] xl:text-[50px]">
              Explore decisions before they become policy.
            </h2>
            <p className="mt-5 max-w-2xl text-[14px] leading-7 text-white/80 sm:text-[15px]">
              Model how enrollment, course capacity, pass rates, and prerequisites
              shape student progression across Qatar University&apos;s CS and CE programs.
              Use the results to ask better questions—not to replace academic judgment.
            </p>

            <div className="mt-7 flex flex-wrap gap-3">
              <Link
                to="/cohort"
                className="home-primary-cta inline-flex items-center gap-2 rounded-lg bg-white px-5 py-3 text-[12px] font-bold shadow-lg shadow-black/10 transition-transform hover:-translate-y-0.5"
              >
                Start with Cohort Flow <ArrowRight size={15} />
              </Link>
              <Link
                to="/chat"
                className="inline-flex items-center gap-2 rounded-lg border border-white/20 bg-white/[0.08] px-5 py-3 text-[12px] font-bold text-white backdrop-blur-sm transition-colors hover:bg-white/[0.13]"
              >
                <Sparkles size={15} /> Ask the AI Assistant
              </Link>
            </div>

            <div className="mt-7 flex flex-wrap gap-x-5 gap-y-2 text-[10px] font-semibold text-white/68">
              <span className="flex items-center gap-1.5"><CheckCircle2 size={13} /> CS and CE models</span>
              <span className="flex items-center gap-1.5"><CheckCircle2 size={13} /> Transparent assumptions</span>
              <span className="flex items-center gap-1.5"><CheckCircle2 size={13} /> Exportable results</span>
            </div>
          </div>

          <div className="home-decision-path">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/55">A planning workflow</div>
                <div className="mt-1 text-[15px] font-bold text-white">From question to evidence</div>
              </div>
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-[#eadfce]">
                <Bot size={19} />
              </span>
            </div>

            <div className="space-y-2.5">
              <PathStep icon={Lightbulb} label="Question" text="Frame the decision you need to make" />
              <PathStep icon={SlidersHorizontal} label="Conditions" text="Set the program and assumptions" />
              <PathStep icon={Activity} label="Simulation" text="Run the appropriate model" />
              <PathStep icon={FileDown} label="Evidence" text="Review, compare, and export" isLast />
            </div>
          </div>
        </div>
      </section>

      <section>
        <SectionHeading
          eyebrow="Choose your starting point"
          title="Four simulations, four different questions"
          text="Pick the model that matches the decision in front of you. Each page explains and visualizes its own result."
        />
        <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
          {SIMULATORS.map((simulator) => (
            <SimulatorCard key={simulator.route} simulator={simulator} />
          ))}
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.18fr_.82fr]">
        <div className="qu-card p-5 sm:p-6">
          <SectionHeading
            eyebrow="A simple method"
            title="How to use the simulator"
            text="Treat every run as a structured planning experiment."
            compact
          />
          <div className="mt-5 grid gap-3 md:grid-cols-3">
            {WORKFLOW.map((step) => {
              const Icon = step.icon;
              return (
                <div key={step.number} className="rounded-xl border border-qu-border bg-qu-off-white p-4">
                  <div className="flex items-center justify-between">
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white text-qu-maroon shadow-sm">
                      <Icon size={17} />
                    </span>
                    <span className="text-[11px] font-bold tracking-[0.14em] text-qu-maroon/35">{step.number}</span>
                  </div>
                  <h4 className="mt-5 text-[13px] font-bold text-qu-text">{step.title}</h4>
                  <p className="mt-2 text-[11px] leading-relaxed text-qu-text-muted">{step.text}</p>
                </div>
              );
            })}
          </div>
        </div>

        <div className="qu-card overflow-hidden p-0">
          <div className="border-b border-qu-border bg-[#fbf8f3] p-5 sm:p-6">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-qu-maroon text-white">
                <Database size={18} />
              </span>
              <div>
                <h3 className="text-[15px] font-bold text-qu-text">Know what is behind the model</h3>
                <p className="mt-1 text-[11px] leading-relaxed text-qu-text-muted">
                  Catalog structure and published data are kept separate from documented assumptions.
                </p>
              </div>
            </div>
          </div>
          <div className="space-y-3 p-5 sm:p-6">
            <HomeLink
              to="/about-data"
              title="Review data sources"
              text="See which inputs are published and which are assumed."
            />
            <HomeLink
              to="/data-override"
              title="Replace assumed values"
              text="Enter department figures when better data is available."
            />
            <div className="rounded-lg border border-qu-warning/20 bg-qu-warning/[0.06] px-4 py-3 text-[10px] leading-relaxed text-qu-text-muted">
              Simulation output is exploratory evidence. It is not a prediction
              or a student record, and it does not prescribe an action.
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-qu-border bg-white px-5 py-6 sm:px-7">
        <div className="grid items-center gap-5 lg:grid-cols-[.75fr_1.25fr]">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-qu-maroon">Questions worth exploring</div>
            <h3 className="mt-2 text-[20px] font-bold tracking-[-0.025em] text-qu-text">Start with the decision, then choose the model.</h3>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {QUESTIONS.map((question) => (
              <div key={question} className="flex items-center gap-2.5 rounded-lg bg-qu-off-white px-3.5 py-3 text-[11px] font-semibold text-qu-text">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-qu-maroon" />
                {question}
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

function PathStep({ icon: Icon, label, text, isLast = false }) {
  return (
    <div className="relative flex items-center gap-3 rounded-xl border border-white/10 bg-black/[0.08] px-3.5 py-3">
      {!isLast && <span className="absolute -bottom-3 left-[31px] h-3 w-px bg-white/18" />}
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/10 text-[#eadfce]">
        <Icon size={15} />
      </span>
      <div className="min-w-0">
        <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-white/58">{label}</div>
        <div className="mt-0.5 text-[11px] font-semibold text-white/90">{text}</div>
      </div>
    </div>
  );
}

function SimulatorCard({ simulator }) {
  const Icon = simulator.icon;
  const accentStyles = {
    maroon: "bg-qu-maroon/[0.08] text-qu-maroon ring-qu-maroon/10",
    amber: "bg-qu-warning/[0.08] text-qu-warning ring-qu-warning/10",
    green: "bg-qu-success/[0.08] text-qu-success ring-qu-success/10",
    blue: "bg-[#eff5f8] text-[#32637b] ring-[#32637b]/10",
  };

  return (
    <Link
      to={simulator.route}
      className="group qu-card flex min-h-[245px] flex-col p-5 transition-all duration-200 hover:-translate-y-1 hover:border-qu-maroon/25 hover:shadow-[0_22px_45px_-32px_rgba(74,15,40,.55)] sm:p-6"
    >
      <div className="flex items-start justify-between gap-4">
        <span className={`flex h-11 w-11 items-center justify-center rounded-xl ring-1 ${accentStyles[simulator.accent]}`}>
          <Icon size={20} />
        </span>
        <ArrowRight size={17} className="mt-1 text-qu-text-muted/45 transition-transform group-hover:translate-x-1 group-hover:text-qu-maroon" />
      </div>
      <div className="mt-5 text-[9px] font-bold uppercase tracking-[0.16em] text-qu-maroon">{simulator.eyebrow}</div>
      <h3 className="mt-1.5 text-[17px] font-bold tracking-[-0.02em] text-qu-text">{simulator.title}</h3>
      <p className="mt-2 text-[12px] font-semibold leading-relaxed text-qu-text">{simulator.question}</p>
      <p className="mt-2 text-[11px] leading-relaxed text-qu-text-muted">{simulator.description}</p>
      <div className="mt-auto flex flex-wrap gap-2 pt-5">
        {simulator.outputs.map((output) => (
          <span key={output} className="rounded-full border border-qu-border bg-qu-off-white px-2.5 py-1 text-[9px] font-semibold text-qu-text-muted">
            {output}
          </span>
        ))}
      </div>
    </Link>
  );
}

function SectionHeading({ eyebrow, title, text, compact = false }) {
  return (
    <div className={compact ? "" : "max-w-3xl"}>
      <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-qu-maroon">{eyebrow}</div>
      <h3 className="mt-2 text-[22px] font-bold tracking-[-0.03em] text-qu-text sm:text-[25px]">{title}</h3>
      <p className="mt-2 text-[12px] leading-relaxed text-qu-text-muted">{text}</p>
    </div>
  );
}

function HomeLink({ to, title, text }) {
  return (
    <Link to={to} className="group flex items-center justify-between gap-4 rounded-lg border border-qu-border px-4 py-3 hover:border-qu-maroon/25 hover:bg-qu-off-white">
      <div>
        <div className="text-[11px] font-bold text-qu-text">{title}</div>
        <div className="mt-0.5 text-[10px] text-qu-text-muted">{text}</div>
      </div>
      <ArrowRight size={14} className="shrink-0 text-qu-text-muted/50 transition-transform group-hover:translate-x-1 group-hover:text-qu-maroon" />
    </Link>
  );
}
