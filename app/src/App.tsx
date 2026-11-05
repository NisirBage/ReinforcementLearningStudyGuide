// Routes. Every page except the dashboard and not-found is its own chunk, fetched when first opened
// (Milestone 3A, D-031); pages that show maths also pull in the KaTeX/markdown chunk.
import { Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { lazyPage } from "./components/Boundary";
import { Dashboard } from "./pages/Dashboard";
import { NotFound } from "./pages/NotFound";

const learn = () => import("./pages/Learn");
const items = () => import("./pages/Items");
const revision = () => import("./pages/Revision");
const progress = () => import("./pages/Progress");

const LearnIndex = lazyPage(learn, (m) => m.LearnIndex);
const UnitPage = lazyPage(learn, (m) => m.UnitPage);
const SectionPage = lazyPage(learn, (m) => m.SectionPage);
const ConceptPage = lazyPage(items, (m) => m.ConceptPage);
const ItemPage = lazyPage(items, (m) => m.ItemPage);
const AlgorithmPage = lazyPage(() => import("./pages/Explainer"), (m) => m.AlgorithmPage);
const PracticePage = lazyPage(() => import("./pages/Practice"), (m) => m.PracticePage);
const exam = () => import("./pages/Exam");
const ExamPage = lazyPage(exam, (m) => m.ExamPage);
const ExamResultPage = lazyPage(exam, (m) => m.ExamResultPage);
const ExamHistoryPage = lazyPage(exam, (m) => m.ExamHistoryPage);
const lab = () => import("./pages/Lab");
const LabHub = lazyPage(lab, (m) => m.LabHub);
const LabPage = lazyPage(lab, (m) => m.LabPage);
const SearchPage = lazyPage(() => import("./pages/Search"), (m) => m.SearchPage);
const RevisionHub = lazyPage(revision, (m) => m.RevisionHub);
const ReviewPage = lazyPage(revision, (m) => m.ReviewPage);
const EquationLibrary = lazyPage(revision, (m) => m.EquationLibrary);
const AlgorithmLibrary = lazyPage(revision, (m) => m.AlgorithmLibrary);
const NotationPage = lazyPage(revision, (m) => m.NotationPage);
const MarkedQuestions = lazyPage(revision, (m) => m.MarkedQuestions);
const ProgressPage = lazyPage(progress, (m) => m.ProgressPage);
const SettingsPage = lazyPage(progress, (m) => m.SettingsPage);

const PAGES = [LabHub, LabPage, AlgorithmPage, ExamPage, ExamResultPage, ExamHistoryPage, PracticePage, LearnIndex, UnitPage, SectionPage, ConceptPage, ItemPage, SearchPage, RevisionHub, ReviewPage, EquationLibrary, AlgorithmLibrary, NotationPage, MarkedQuestions, ProgressPage, SettingsPage];
/** Fetches the code of every page now (Settings → Save for offline; tests). */
export const preloadRoutes = () => Promise.all(PAGES.map((p) => p.preload())).then(() => undefined);

export function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="learn" element={<LearnIndex />} />
        <Route path="learn/:unit" element={<UnitPage />} />
        <Route path="learn/:unit/:section" element={<SectionPage />} />
        <Route path="concept/:id" element={<ConceptPage />} />
        <Route path="equation/:id" element={<ItemPage kind="equation" />} />
        <Route path="algorithm/:id" element={<AlgorithmPage />} />
        <Route path="example/:id" element={<ItemPage kind="example" />} />
        <Route path="figure/:id" element={<ItemPage kind="figure" />} />
        <Route path="practice" element={<PracticePage />} />
        <Route path="exam" element={<ExamPage />} />
        <Route path="exam/history" element={<ExamHistoryPage />} />
        <Route path="exam/result/:id" element={<ExamResultPage />} />
        <Route path="lab" element={<LabHub />} />
        <Route path="lab/:slug" element={<LabPage />} />
        <Route path="search" element={<SearchPage />} />
        <Route path="revision" element={<RevisionHub />} />
        <Route path="revision/review" element={<ReviewPage />} />
        <Route path="revision/equations" element={<EquationLibrary />} />
        <Route path="revision/algorithms" element={<AlgorithmLibrary />} />
        <Route path="revision/notation" element={<NotationPage />} />
        <Route path="revision/marked" element={<MarkedQuestions />} />
        <Route path="progress" element={<ProgressPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
