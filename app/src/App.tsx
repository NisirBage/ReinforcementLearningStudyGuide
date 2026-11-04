import { Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { Dashboard } from "./pages/Dashboard";
import { LearnIndex, SectionPage, UnitPage } from "./pages/Learn";
import { ConceptPage, ItemPage } from "./pages/Items";
import { SearchPage } from "./pages/Search";
import { AlgorithmLibrary, EquationLibrary, MarkedQuestions, NotationPage, ReviewPage, RevisionHub } from "./pages/Revision";
import { ProgressPage, SettingsPage } from "./pages/Progress";
import { NotFound } from "./pages/NotFound";

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
        <Route path="algorithm/:id" element={<ItemPage kind="algorithm" />} />
        <Route path="example/:id" element={<ItemPage kind="example" />} />
        <Route path="figure/:id" element={<ItemPage kind="figure" />} />
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
