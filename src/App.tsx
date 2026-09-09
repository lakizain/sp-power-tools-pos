import { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AppProvider, useApp, useFeatureToggles } from './context/SupabaseAppContext';
import { CurrencyProvider } from './context/CurrencyContext';
import { ThemeProvider } from './context/ThemeContext';
import { LoadingSpinner } from './components/ui/LoadingComponents';
import { LoginPage } from './components/auth/LoginPage';
import { Header } from './components/layout/Header';
import { POSTerminal } from './components/pos/POSTerminal';
import { TransactionsManager } from './components/transactions/TransactionsManager';
import { InventoryManager } from './components/inventory/InventoryManager';
import { CustomerManager } from './components/customers/CustomerManager';
import { ReportsManager } from './components/reports/ReportsManager';
import { Settings } from './components/settings/Settings';
import { DiscountManager } from './components/discounts/DiscountManager';
import { UserManager } from './components/users/UserManager';
import { SupplierManager } from './components/suppliers/SupplierManager';
import { ExpenseManager } from './components/expenses/ExpenseManager';
import { ReturnsManager } from './components/returns/ReturnsManager';
import { OutstandingPayments } from './components/payments/OutstandingPayments';
import { AlertManager } from './components/alerts/AlertManager';
import { RentalsManager } from './components/rentals/RentalsManager';
import { isSupabaseConfigured, getMissingSupabaseEnvMessage } from './lib/supabase';
import { AlertTriangle, Settings as SettingsIcon, ArrowRight } from 'lucide-react';

function MissingEnvScreen() {
  const msg = getMissingSupabaseEnvMessage();
  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-amber-50 flex items-center justify-center p-6">
      <div className="max-w-2xl w-full bg-white/80 backdrop-blur-xl rounded-3xl shadow-large border border-white/50 p-8">
        <div className="flex items-start space-x-5">
          <div className="flex-shrink-0 w-16 h-16 rounded-2xl bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center shadow-lg">
            <AlertTriangle className="h-8 w-8 text-white" />
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Setup Required</h1>
            <p className="text-gray-600 mb-5">
              Supabase environment variables are not configured. Please follow these steps:
            </p>

            <div className="space-y-4">
              <div className="rounded-2xl bg-red-50/80 border border-red-200/60 p-5">
                <div className="flex items-center space-x-2 mb-2">
                  <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-red-500 text-white text-xs font-bold">1</span>
                  <h3 className="font-semibold text-gray-900">Open Vercel Dashboard</h3>
                </div>
                <p className="text-sm text-gray-600 ml-8">
                  Go to <span className="font-mono bg-white px-2 py-0.5 rounded border">https://vercel.com</span> → Your project
                </p>
              </div>

              <div className="rounded-2xl bg-orange-50/80 border border-orange-200/60 p-5">
                <div className="flex items-center space-x-2 mb-2">
                  <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-orange-500 text-white text-xs font-bold">2</span>
                  <h3 className="font-semibold text-gray-900 flex items-center space-x-2">
                    <SettingsIcon className="h-4 w-4" />
                    <span>Navigate to Settings → Environment Variables</span>
                  </h3>
                </div>
                <p className="text-sm text-gray-600 ml-8">
                  Add these variables (tick all 3 environments: Production, Preview, Development)
                </p>
                <div className="mt-3 ml-8 space-y-2">
                  <div className="bg-white rounded-xl p-3 border border-orange-100 font-mono text-xs">
                    <div className="grid grid-cols-2 gap-2">
                      <div><span className="font-bold text-orange-700">Key:</span> VITE_SUPABASE_URL</div>
                      <div><span className="font-bold text-orange-700">Value:</span> https://your-project.supabase.co</div>
                    </div>
                  </div>
                  <div className="bg-white rounded-xl p-3 border border-orange-100 font-mono text-xs">
                    <div className="grid grid-cols-2 gap-2">
                      <div><span className="font-bold text-orange-700">Key:</span> VITE_SUPABASE_ANON_KEY</div>
                      <div><span className="font-bold text-orange-700">Value:</span> (your anon public key)</div>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500">
                    👉 Find these in Supabase Dashboard → <span className="font-semibold">Project Settings → API</span>
                  </p>
                </div>
              </div>

              <div className="rounded-2xl bg-emerald-50/80 border border-emerald-200/60 p-5">
                <div className="flex items-center space-x-2 mb-2">
                  <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-500 text-white text-xs font-bold">3</span>
                  <h3 className="font-semibold text-gray-900">Redeploy</h3>
                </div>
                <p className="text-sm text-gray-600 ml-8">
                  After saving, go to <span className="font-semibold">Deployments</span> → click the 3 dots next to your latest deployment → <span className="font-semibold">Redeploy</span>
                </p>
                <div className="mt-3 ml-8 flex items-center space-x-2 text-xs text-emerald-700">
                  <ArrowRight className="h-3 w-3" />
                  <span>Do NOT just refresh the page — new env vars only take effect after a fresh build/redeploy.</span>
                </div>
              </div>
            </div>

            {msg && (
              <div className="mt-6 p-4 bg-gray-900 rounded-2xl overflow-auto">
                <p className="text-xs font-mono text-red-300 whitespace-pre-wrap">
                  {msg}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function AppContent() {
  const { user, loading } = useAuth();
  const { state } = useApp();
  const features = useFeatureToggles();
  const [currentView, setCurrentView] = useState('pos');

  // Show loading spinner while auth is loading
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-secondary-50 to-primary-50 dark:from-secondary-900 dark:to-secondary-800 flex items-center justify-center">
        <LoadingSpinner size="lg" text="Loading S&P POWER TOOLS POS..." />
      </div>
    );
  }

  // Show login page if no user is authenticated
  if (!user || !state.currentUser) {
    return <LoginPage />;
  }

  const renderCurrentView = () => {
    const userRole = state.currentUser?.role;

    // Restrict cashiers to POS only
    if (userRole === 'cashier' && currentView !== 'pos') {
      setCurrentView('pos');
      return <POSTerminal />;
    }

    switch (currentView) {
      case 'pos':
        return <POSTerminal />;
      case 'transactions':
        // Only allow admin and manager to access transactions
        if (userRole === 'admin' || userRole === 'manager') {
          return <TransactionsManager />;
        }
        setCurrentView('pos');
        return <POSTerminal />;
      case 'inventory':
        // Only allow admin and manager to access inventory
        if (userRole === 'admin' || userRole === 'manager') {
          return <InventoryManager />;
        }
        setCurrentView('pos');
        return <POSTerminal />;
      case 'customers':
        // Only allow admin and manager to access customers
        if (userRole === 'admin' || userRole === 'manager') {
          return <CustomerManager />;
        }
        setCurrentView('pos');
        return <POSTerminal />;
      case 'reports':
        // Only allow admin and manager to access reports
        if (userRole === 'admin' || userRole === 'manager') {
          return <ReportsManager />;
        }
        setCurrentView('pos');
        return <POSTerminal />;
      case 'discounts':
        // Only allow admin and manager to access discounts - also gated by feature toggle
        if ((userRole === 'admin' || userRole === 'manager') && features.productDiscount) {
          return <DiscountManager />;
        }
        if (!features.productDiscount && (userRole === 'admin' || userRole === 'manager')) {
          setCurrentView('pos');
        }
        setCurrentView('pos');
        return <POSTerminal />;
      case 'suppliers':
        // Only allow admin and manager to access suppliers - gated by feature toggle
        if ((userRole === 'admin' || userRole === 'manager') && features.supplierManagement) {
          return <SupplierManager />;
        }
        setCurrentView('pos');
        return <POSTerminal />;
      case 'expenses':
        // Only allow admin and manager to access expenses - gated by feature toggle
        if ((userRole === 'admin' || userRole === 'manager') && features.expenseTracking) {
          return <ExpenseManager />;
        }
        setCurrentView('pos');
        return <POSTerminal />;
      case 'returns':
        // Only allow admin and manager to access returns - gated by feature toggle
        if ((userRole === 'admin' || userRole === 'manager') && features.productReturns) {
          return <ReturnsManager />;
        }
        setCurrentView('pos');
        return <POSTerminal />;
      case 'rentals':
        // Only allow admin and manager to access rentals - gated by feature toggle
        if ((userRole === 'admin' || userRole === 'manager') && features.productRentals) {
          return <RentalsManager />;
        }
        setCurrentView('pos');
        return <POSTerminal />;
      case 'payments':
        // Only allow admin and manager to access outstanding payments - gated by feature toggle
        if ((userRole === 'admin' || userRole === 'manager') && features.outstandingPayments) {
          return <OutstandingPayments />;
        }
        setCurrentView('pos');
        return <POSTerminal />;
      case 'alerts':
        // Only allow admin and manager to access alerts - gated by feature toggle
        if ((userRole === 'admin' || userRole === 'manager') && features.alertMonitoring) {
          return <AlertManager />;
        }
        setCurrentView('pos');
        return <POSTerminal />;
      case 'users':
        // Only allow admin to access users
        if (userRole === 'admin') {
          return <UserManager />;
        }
        setCurrentView('pos');
        return <POSTerminal />;
      case 'settings':
        return <Settings />;
      default:
        return <POSTerminal />;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-secondary-50 to-primary-50 dark:from-secondary-900 dark:to-secondary-800 flex flex-col">
      <Header currentView={currentView} onViewChange={setCurrentView} />
      <main className="flex-1 overflow-hidden">
        {state.loading ? (
          <div className="flex items-center justify-center h-full">
            <LoadingSpinner size="lg" text="Loading..." />
          </div>
        ) : (
          <div className="animate-fade-in">
            {renderCurrentView()}
          </div>
        )}
      </main>
    </div>
  );
}

function App() {
  if (!isSupabaseConfigured) {
    return <MissingEnvScreen />;
  }

  return (
    <ThemeProvider>
      <AuthProvider>
        <AppProvider>
          <CurrencyProvider>
            <AppContent />
          </CurrencyProvider>
        </AppProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;