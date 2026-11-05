import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Index from "./pages/Index.tsx";
import Commands from "./pages/Commands.tsx";
import Partners from "./pages/Partners.tsx";
import News from "./pages/News.tsx";
import Devs from "./pages/Devs.tsx";
import Features from "./pages/Features.tsx";
import Status from "./pages/Status.tsx";
import Stats from "./pages/Stats.tsx";
import Uptime from "./pages/Uptime.tsx";
import Premium from "./pages/Premium.tsx";
import FAQ from "./pages/FAQ.tsx";
import Docs from "./pages/Docs.tsx";
import Privacy from "./pages/Privacy.tsx";
import Terms from "./pages/Terms.tsx";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/commands" element={<Commands />} />
          <Route path="/partners" element={<Partners />} />
          <Route path="/news" element={<News />} />
          <Route path="/devs" element={<Devs />} />
          <Route path="/features" element={<Features />} />
          <Route path="/status" element={<Status />} />
          <Route path="/stats" element={<Stats />} />
          <Route path="/uptime" element={<Uptime />} />
          <Route path="/premium" element={<Premium />} />
          <Route path="/faq" element={<FAQ />} />
          <Route path="/docs" element={<Docs />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
