import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import AccessPortal from "./pages/AccessPortal";
import Home from "./pages/Home";

function Router() {
  return (
    <Switch>
      <Route path="/" component={AccessPortal} />
      <Route path="/staff" component={Home} />
      <Route path="/staff/nouveau-dossier" component={Home} />
      <Route path="/staff/tableau-de-bord" component={Home} />
      <Route path="/staff/protocoles" component={Home} />
      <Route path="/nouveau-dossier" component={Home} />
      <Route path="/tableau-de-bord" component={Home} />
      <Route path="/protocoles" component={Home} />
      <Route path="/patient/:token" component={Home} />
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
