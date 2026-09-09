# Product Rentals + Rent Return Implementation Plan

## Repository Research

### පවතින Architecture සම්බන්ධයෙන් සාරාංශය

**Project**: S&P POWER TOOLS POS — React + TypeScript + Supabase (PostgreSQL)

**පවතින Module Structure**:
- Feature Toggles 7ක් `FeatureToggles interface එකේ අර්ථ දක්වා ඇත: `transactionDelete`, `productReturns`, `outstandingPayments`, `productDiscount`, `expenseTracking`, `supplierManagement`, `alertMonitoring` (සියල්ලම default: true)
- Feature toggles load වේ `app_settings.feature_toggles JSONB column එකෙන් (services.ts පේළි 565, 600)
- Core State Management: `SupabaseAppContext.tsx` එකේ useReducer + Context API (AppState, AppAction)
- Data Service Layer: `src/lib/services.ts` එකේ productsService, customersService, returnsService, outstandingPaymentsService ආදී CRUD services
- Routing: `App.tsx` renderCurrentView() එකේ role check (admin/manager) + feature toggle check
- Navigation: `Header.tsx` getNavigationItems() එකෙන් role + feature toggle අනුව menu items පෙන්වයි

**Returns Module (පවතින)**:
- `ProductReturn` interface එකේ `returnMethod: 'refund' | 'exchange' | 'store_credit'
- ReturnModal එකේ restocked field එක පවති නමුත් ADD_RETURN/UPDATE_RETURN reducers වලින් Product stock එක නැවත එකතු නොවේ (bug වගේම)
- Database CHECK constraint එක තියෙනවා `product_returns.return_method IN ('refund','exchange','store_credit','reject') ලෙස — `product_returns` table එකේ

### User අවශ්‍යතා පරාසය
1. **Returns module එකට **Rent Item Return** returnMethod එකක් එකතු කිරීම
   - Item එක return වීමෙන් පසු stock එක නැවත Inventory එකට එකතු විය යුතුය (restock = true)
   - නමුත් **මුදල් ආපසු දිය යුතු නැත (totalRefund = 0)
2. **Rent Items track කිරීමට වෙනම Rentals Page එකක් සෑදීම
   - Active rentals, Overdue rentals, Completed rentals status badges
   - Customer, Items, Rent dates, Deposit/Payment tracking
   - Rental record එකක් create/delete/edit කිරීම

---

## Files and Modules

| File Path | Expected Change |
|---|---|
| `src/types/index.ts` | `FeatureToggles ට `productRentals` field එකතු කිරීම. `ProductReturn['returnMethod']` ට 'rental_return' එකතු කිරීම. නව `Rental`, `RentalItem` interfaces අර්ථ දක්වා තැබීම |
| `SupaBase/migration_rentals_2026_09_09.sql` (නව) | `rentals` + `rental_items` tables සෑදීම. `product_returns.return_method` CHECK constraint එක update කිරීම. Triggers, RLS policies, GRANTs |
| `src/lib/services.ts` | `rentalsService` (CRUD) එකතු කිරීම. returnsService එක 'rental_return' returnMethod handle කිරීමට සකස් කිරීම. restock inventory update logic එකතු කිරීම |
| `src/context/SupabaseAppContext.tsx` | AppState ට `rentals: Rental[]` එකතු කිරීම. AppAction actions (SET/ADD/UPDATE/DELETE_RENTALS). reducers. loadData() එකට rentals fetch එකතු කිරීම. defaultFeatureToggles ට `productRentals: true` එකතු කිරීම |
| `src/components/returns/ReturnModal.tsx` | ReturnMethod dropdown ට 'Rental Item Return' option එකතු කිරීම. එය තෝරා ගත් විට: totalRefund=0, restocked=true, refund UI hidden කරන්න |
| `src/components/returns/ReturnsManager.tsx` | Filter ට 'Rental Returns' option එකතු කිරීම. status badges වලට 'rental_return' වෙනම badge එකක් දැම්ම |
| `src/components/rentals/RentalsManager.tsx` (නව) | Rentals List page එක. Search, Filter (active/overdue/returned), Summary cards (Total Active, Overdue, This Month Income), Create/Edit/Delete actions, Return Rental action |
| `src/components/rentals/RentalModal.tsx` (නව) | Rental create/edit modal එක. Customer select, Items select (from Products), rent_from/to dates, rates, deposit, notes |
| `src/components/layout/Header.tsx` | Navigation ට 'Rentals' menu item එකතු කිරීම (Admin/Manager + features.productRentals = true) |
| `src/App.tsx` | renderCurrentView() එකට 'rentals' case එකතු කිරීම (role + feature toggle gate) |
| `src/components/settings/Settings.tsx` | Optional Features section ට `productRentals` toggle switch එකතු කිරීම |
| `src/lib/database.types.ts` | rentals + rental_items tables, updated product_returns return_method enum එක සමඟ update කිරීම |

---

## Implementation Steps (Dependency Order)

### Phase 1: Schema + Types

1. **Database Types (Migration**: නව `SupaBase/migration_rentals_2026_09_09.sql` ගොනුව සෑදීම:
   - `rentals` table: `rentals` (id, rental_number (R-0001), customer_id, customer_name, items JSONB, rent_from DATE, rent_to DATE, daily_rate, security_deposit, total_rent, paid_amount, status (active/overdue/returned/lost), notes, created_by, created_at, updated_at) + FK to customers/auth.users
   - `rental_items` table: id, rental_id FK, product_id, product_name, sku, quantity, unit_price, condition
   - `product_returns` CHECK constraint එක ALTER (rental_return' add (IF NOT EXISTS style — using safe way)
   - RLS enable + policies + GRANTs + update_updated_at_column triggers

2. **Type Definitions (`src/types/index.ts`)**:
   - `FeatureToggles` → `productRentals: boolean` එකතු
   - `ProductReturn['returnMethod']` → 'rental_return' එකතු
   - `RentalStatus = 'active' | 'overdue' | 'returned' | 'lost' | 'damaged'
   - `RentalItem` interface: productId, productName, sku, quantity, dailyRate, subtotal
   - `Rental` interface: id, rentalNumber, customerId, customerName, items: RentalItem[], rentFrom, rentTo, dailyRate, weeklyRate?, securityDeposit, totalRent, paidAmount, status, notes, createdBy, createdAt, updatedAt

### Phase 2: Service + Context Layers

3. **Services Layer (`src/lib/services.ts`)**:
   - `rentalsService` service layer එකතු කිරීම (getAll, create, update, delete, getById)
   - returnsService.create/update වල: returnMethod === 'rental_return' නම් restocked=true, totalRefund=0 ensure කිරීම
   - returnsService: Product stock restock function එකතු කිරීම (return status completed වෙලා තියෙවනම් product.stock += quantity (if product_id valid නොවේ නම් skip)

4. **State Management (`src/context/SupabaseAppContext.tsx`)**:
   - `AppState` → rentals: Rental[] එකතු
   - `AppAction` union → SET_RENTALS, ADD_RENTAL, UPDATE_RENTAL, DELETE_RENTAL
   - Reducer cases 4 එකතු
   - initialState.rentals = []
   - `defaultFeatureToggles` → `productRentals: true` එකතු
   - `loadData()` එකේ rentalsService.getAll() parallel fetch එකතු + SET_RENTALS dispatch
   - Logout වෙලා නම් rentals clear කිරීම useEffect එකේ

### Phase 3: Returns Module Updates

5. **ReturnModal Update**:
   - returnMethod select ට `<option value="rental_return">Rental Item Return (Restock, No Refund)</option>` එකතු
   - useMemo/useEffect: formData.returnMethod === 'rental_return' නම්
     - totals calculation force totalRefund = 0 override
     - refund amount display එක gray out කරන්න (or "No refund for rental returns" message
     - restocked field එක auto true සිටිනවා
   - handleSubmit වලට validation: rental return නම් no refund ensure

6. **ReturnsManager Update**:
   - methodFilter dropdown ට `"rental_return"` option එකතු
   - Status badges: returnMethod === 'rental_return' නම් වෙනම purple badge "Rent Return" එකක් පෙන්වන්න

### Phase 4: Rentals Page (නව Components)

7. **RentalsManager.tsx** (ReturnsManager එකේ style එක අනුව):
   - Header + Summary cards: Total Active, Overdue Count, This Month Rent, Total Security Deposit
   - Search bar (customer name, rental number)
   - Filters: All / Active / Overdue / Returned / Lost
   - Table: Rental #, Customer, Items Count, Rent Period, Amount, Status badges, Actions
   - Actions: Add Rental, Edit, Delete, Mark as Returned (ඒ කියන action එකෙන් ReturnModal එකට navigate කරන්න (rental items pre-fill කරලා)

8. **RentalModal.tsx**:
   - Customer dropdown (state.customers ගෙන්)
   - Rent From / Rent To date pickers
   - Daily Rate + Weekly Rate fields
   - Security Deposit
   - Items add/remove (Products select + quantity)
   - Notes field
   - Submit button

### Phase 5: Navigation + Routing + Settings

9. **Header.tsx**:
   - `import { KeyRound } from 'lucide-react' (icon එකක් ගන්න - rentals icon එකක් විදියට
   - getNavigationItems() එකේ:
     ```typescript
     if (isAdminOrManager && features.productRentals) {
       items.push({ id: 'rentals', label: 'Rentals', icon: KeyRound, color: 'text-violet-600' });
     }
     ```

10. **App.tsx routing**:
    - imports RentalsManager
    - renderCurrentView() එකේ switch case එකතු:
      ```typescript
      case 'rentals':
        if ((userRole === 'admin' || userRole === 'manager') && features.productRentals) {
          return <RentalsManager />;
        }
        setCurrentView('pos');
        return <POSTerminal />;
      ```

11. **Settings.tsx Optional Features**:
    - Toggle switch එක: Product Rentals එකතු (handleFeatureToggle එක ඇතුලට

12. **database.types.ts**: Migration එක script එක හරහා update කිරීම / manual update

---

## Dependencies and Considerations

1. **Idempotent Migration**: Migration script එක හැම වතාවක්ම RUN කරන්න පුලුවන් විදියට `CREATE TABLE IF NOT EXISTS`, `DO $$ ... $$` blocks, `ON CONFLICT DO NOTHING` භාවිතා කරන්න.
2. **CHECK Constraint Safe Update**: product_returns.return_method CHECK constraint එක add කරන්නේ safe විදියට (මුලින්ම පරීක්ෂා කරලා existing වලින් 'rental_return' ඉතින්ම නැත්නම් ALTER TABLE කරන්න.
3. **Restock Logic**: Rental return confirm වූ විට product_id undefined වුණොත් (custom items / deleted products) silently ignore කරන්න.
4. **UI Consistency**: Existing ReturnsManager, ExpenseManager වගේම design භාවිතා කරන්න (lucide icons, rounded-3xl cards, gradient badges ආදී style අනුව).
5. **Feature Toggle Default**: productRentals default true දෙන්න; Settings එකෙන් off කරන්න පුලුවන්.
6. **Rentals Page to Return Flow**: RentalsManager එකේ "Mark as Returned" button එක click කලාට ReturnModal එක open වේ; rental items pre-fill, returnMethod = 'rental_return' preset කරන්න.
7. **Overdue Calculation**: RentalsManager එකේ status calculation: rent_to < TODAY() && status==='active' නම් overdue ලෙස count කරන්න (UI badge level).

---

## Validation (Implementation පසු check කිරීම)

1. **TypeScript Compile**: `npm run build` (or `npx tsc --noEmit`) TypeScript errors check
2. **Migration Test**: Supabase SQL Editor එකට migration paste කරලා script එක RUN කරන්න; errors නැතිව run වෙනවාද බලන්න
3. **Feature Toggle Check**:
   - Settings → Optional Features → Product Rentals toggle on/off කරන්න පුලුවන්ද
   - Off කරලා නම් Header Rentals menu එකෙන් disappear වෙනවාද
   - App.tsx routing redirect කරලා POS වලට යනවාද
4. **Rental CRUD Test**:
   - Rental අලුතක් create කරන්න පුලුවන්ද (customer + items + dates + deposit
   - RentalsManager list එකේ පෙනෙනවාද
   - Edit / delete කළ හැකිද
5. **Rental Return Test**:
   - RentalsManager එකේ "Mark as Returned" click කලාට ReturnModal එක load වේද
   - returnMethod = 'rental_return' preset වේද
   - Total Refund = 0 වේද
   - Confirm කලාට product.stock එක වැඩි වෙනවාද
   - returns list එකේ "Rent Return" badge එක පෙනෙනවාද
6. **Normal Returns Unchanged**: සාමාන්‍ය refund/exchange/store_credit returns හැටි ගැටෙන්නැතිව පැටි ගැහැන්ට ඕනෑම කෙනෙකුට අවශ්‍ය පරිදි ක්‍රියා කළ හැකිද

---

## Risks and Handling

| Risk | Mitigation |
|---|---|
| Migration CHECK constraint ALTER TABLE failure | DO $$ BEGIN ... EXCEPTION WHEN duplicate_object THEN NULL; END; $$ භාවිතා කරලා safe wrapping කරන්න |
| Product stock overflow | Product id invalid (product delete කලා නැත්නම්) | restock service එකේ try/catch + product exists check |
| Rentals huge page load performance | rentals fetch කිරීමේ parallel Promise.all එකේ error ළඟට අමතක නොවේ |
| existing returns conflict feature off | Migration එක idempotent විදියට handle කරන්න; Supabase එකේ `IF NOT EXISTS` |
| Rental → Return flow විවේචකයා context sync අමතක වීමට සලාස්ස් | dispatch sequence testing; handleReturned rental එකක් mark කලාට UPDATE_RENTAL (status= 'returned') + ADD_RETURN දෙකම dispatch කරන්න |
