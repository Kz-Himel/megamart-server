import { prisma } from '../lib/prisma';

const BASE_URL = 'http://localhost:5000/api';

async function request(endpoint: string, options: { method?: string; body?: any; token?: string } = {}) {
  const url = endpoint.startsWith('http') ? endpoint : `${BASE_URL}${endpoint}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (options.token) {
    headers['Authorization'] = `Bearer ${options.token}`;
  }

  const res = await fetch(url, {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const data: any = await res.json().catch(() => null);
  return { status: res.status, data };
}

async function runQASuite() {
  console.log('════════════════════════════════════════════════════════════════');
  console.log('  MEGAMART FULL PLATFORM END-TO-END QA & INTEGRATION SUITE');
  console.log('════════════════════════════════════════════════════════════════\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, errorDetails?: any) {
    if (condition) {
      console.log(`  [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${testName}`, errorDetails !== undefined ? JSON.stringify(errorDetails) : '');
      failed++;
    }
  }

  const ts = Date.now();
  const customerEmail = `qa_cust_${ts}@test.com`;
  const applicantEmail = `qa_app_${ts}@test.com`;
  const seller2Email = `qa_seller2_${ts}@test.com`;
  const adminEmail = `qa_admin_${ts}@test.com`;
  const testPassword = 'Password123!';

  let customerToken = '';
  let customerId = '';
  let applicantToken = '';
  let applicantId = '';
  let seller2Token = '';
  let seller2Id = '';
  let adminToken = '';
  let adminId = '';

  let storeId1 = '';
  let storeId2 = '';
  let productId1 = '';
  let productId2 = '';
  let orderId1 = '';
  let categoryId = '';

  try {
    // -----------------------------------------------------------------
    // 1. Customer Authentication & Account Setup
    // -----------------------------------------------------------------
    console.log('--- 1. Customer Authentication & Profile ---');
    
    // Register customer
    const regRes = await request('/auth/register', {
      method: 'POST',
      body: {
        name: 'Sarah Customer',
        email: customerEmail,
        password: testPassword,
      },
    });
    assert(regRes.status === 201 || regRes.status === 200, 'Customer registration successful');
    customerId = regRes.data?.data?.id;
    assert(!!customerId, 'Customer ID generated on registration');

    // Login customer
    const loginRes = await request('/auth/login', {
      method: 'POST',
      body: { email: customerEmail, password: testPassword },
    });
    assert(loginRes.status === 200, 'Customer login successful');
    customerToken = loginRes.data?.data?.token;
    assert(!!customerToken, 'Customer JWT token received on login');
    assert(loginRes.data?.data?.user?.role === 'USER', 'Default registered role is USER');

    // Read current user profile via /users/:id
    const meRes = await request(`/users/${customerId}`, { token: customerToken });
    assert(meRes.status === 200 && meRes.data?.data?.email === customerEmail, 'Customer profile retrieved via /users/:id');

    // -----------------------------------------------------------------
    // 2. Multi-Vendor Setup: Setup Admin & Two Independent Sellers
    // -----------------------------------------------------------------
    console.log('\n--- 2. Multi-Vendor Setup & Role Initialization ---');

    // Register applicant 1
    const appReg = await request('/auth/register', {
      method: 'POST',
      body: {
        name: 'Seller One Apex',
        email: applicantEmail,
        password: testPassword,
      },
    });
    applicantId = appReg.data?.data?.id;
    assert(!!applicantId, 'Applicant 1 registered');
    const appLogin = await request('/auth/login', {
      method: 'POST',
      body: { email: applicantEmail, password: testPassword },
    });
    applicantToken = appLogin.data?.data?.token;

    // Register seller 2
    const s2Reg = await request('/auth/register', {
      method: 'POST',
      body: {
        name: 'Seller Two Quantum',
        email: seller2Email,
        password: testPassword,
      },
    });
    seller2Id = s2Reg.data?.data?.id;
    assert(!!seller2Id, 'Seller 2 registered');
    const s2InitialLogin = await request('/auth/login', {
      method: 'POST',
      body: { email: seller2Email, password: testPassword },
    });
    seller2Token = s2InitialLogin.data?.data?.token;

    // Register admin user and promote to ADMIN
    const adminReg = await request('/auth/register', {
      method: 'POST',
      body: {
        name: 'Platform Overseer Admin',
        email: adminEmail,
        password: testPassword,
      },
    });
    adminId = adminReg.data?.data?.user?.id || adminReg.data?.data?.id;
    assert(!!adminId, 'Admin account registered');
    await prisma.user.update({
      where: { id: adminId },
      data: { role: 'ADMIN' },
    });
    // Login admin to obtain JWT with ADMIN role
    const adminLogin = await request('/auth/login', {
      method: 'POST',
      body: { email: adminEmail, password: testPassword },
    });
    adminToken = adminLogin.data?.data?.token;
    assert(adminLogin.data?.data?.user?.role === 'ADMIN', 'Admin user verified with ADMIN role');

    // Fetch an active category
    let cat = await prisma.category.findFirst({ where: { status: 'ACTIVE' } });
    if (!cat) {
      cat = await prisma.category.create({
        data: {
          name: `Electronics ${ts}`,
          slug: `electronics-${ts}`,
          status: 'ACTIVE',
        },
      });
    }
    categoryId = cat.id;
    assert(!!categoryId, `Active category available: ${cat.name}`);

    // -----------------------------------------------------------------
    // 3. Security: Anti-Tampering & Privilege Escalation Defenses
    // -----------------------------------------------------------------
    console.log('\n--- 3. Security: Anti-Tampering & Privilege Escalation Defenses ---');

    // Test: Customer directly calling seller routes before approval -> MUST 403
    const directSellerRoute = await request('/seller/products', {
      method: 'POST',
      token: customerToken,
      body: { name: 'Hack Product', price: 10, stock: 1, categoryId },
    });
    assert(directSellerRoute.status === 403, 'Customer cannot create products directly (HTTP 403 Forbidden)');

    // Test: Non-admin calling admin moderation route -> MUST 403
    const unauthorizedAdminCall = await request('/admin/sellers', { token: customerToken });
    assert(unauthorizedAdminCall.status === 403, 'Customer cannot access admin seller queue (HTTP 403 Forbidden)');

    // Test: Unauthenticated call to protected route -> MUST 401
    const unauthenticatedCall = await request('/seller/me');
    assert(unauthenticatedCall.status === 401, 'Unauthenticated request to seller profile is rejected (HTTP 401)');

    // -----------------------------------------------------------------
    // 4. Seller Application Workflow & Validation
    // -----------------------------------------------------------------
    console.log('\n--- 4. Seller Application Lifecycle & State Transitions ---');

    // Validation: Missing required fields (should trigger 400 Validation Error)
    const invalidApp = await request('/seller/apply', {
      method: 'POST',
      token: applicantToken,
      body: { name: '' },
    });
    assert(invalidApp.status === 400, 'Empty seller application is rejected with HTTP 400');

    // Valid Application submission
    const validApp = await request('/seller/apply', {
      method: 'POST',
      token: applicantToken,
      body: {
        name: `Apex Pro Audio ${ts}`,
        slug: `apex-pro-audio-${ts}`,
        description: 'Premium audiophile monitors and studio hardware.',
        category: 'Electronics',
        email: applicantEmail,
        phone: '+1 555 888 7777',
        address: '100 Studio Way',
        city: 'Seattle',
        country: 'United States',
        taxId: 'US-EIN-99223344',
        verificationDoc: 'https://images.unsplash.com/photo-1544717305-2782549b5136',
        termsAccepted: true,
      },
    });
    assert(validApp.status === 201, 'Applicant submitted valid seller application');
    storeId1 = validApp.data?.data?.id;
    assert(validApp.data?.data?.status === 'PENDING', 'Store status starts as PENDING');

    // Duplicate application rejection while pending
    const duplicateApp = await request('/seller/apply', {
      method: 'POST',
      token: applicantToken,
      body: {
        name: `Apex Pro Audio ${ts}`,
        slug: `apex-pro-audio-${ts}`,
        description: 'Trying duplicate application while pending.',
        category: 'Electronics',
        email: applicantEmail,
        phone: '+1 555 888 7777',
        address: '100 Studio Way',
        city: 'Seattle',
        country: 'United States',
        termsAccepted: true,
      },
    });
    assert(duplicateApp.status === 400, 'Duplicate seller application is rejected (HTTP 400)');

    // Admin Requests Changes
    const requestChanges = await request(`/admin/sellers/${storeId1}/status`, {
      method: 'PATCH',
      token: adminToken,
      body: {
        status: 'CHANGES_REQUESTED',
        reason: 'Please upload clearer business tax documents.',
      },
    });
    assert(requestChanges.data?.data?.status === 'CHANGES_REQUESTED', 'Admin successfully requested changes on application');
    assert(requestChanges.data?.data?.adminFeedback?.includes('tax documents'), 'Admin feedback reason recorded');

    // Applicant updates application & resubmits via POST /seller/apply
    const resubmitApp = await request('/seller/apply', {
      method: 'POST',
      token: applicantToken,
      body: {
        name: `Apex Pro Audio ${ts}`,
        slug: `apex-pro-audio-${ts}`,
        description: 'Revised: Certified High-Fidelity Audio Equipment.',
        category: 'Electronics',
        email: applicantEmail,
        phone: '+1 555 888 7777',
        address: '100 Studio Way',
        city: 'Seattle',
        country: 'United States',
        taxId: 'US-EIN-99223344-REVISED',
        verificationDoc: 'https://images.unsplash.com/photo-1544717305-2782549b5136',
        termsAccepted: true,
      },
    });
    assert(resubmitApp.status === 200 || resubmitApp.status === 201, 'Applicant updated and resubmitted application');
    assert(resubmitApp.data?.data?.status === 'PENDING', 'Application moved back to PENDING upon resubmission');

    // Admin approves Store 1
    const approveStore1 = await request(`/admin/sellers/${storeId1}/status`, {
      method: 'PATCH',
      token: adminToken,
      body: { status: 'APPROVED' },
    });
    assert(approveStore1.data?.data?.status === 'APPROVED', 'Admin approved Store 1 to APPROVED');

    // Re-login applicant to get SELLER token
    const seller1Login = await request('/auth/login', {
      method: 'POST',
      body: { email: applicantEmail, password: testPassword },
    });
    applicantToken = seller1Login.data?.data?.token;

    // Fast-track Store 2 for cross-seller isolation tests
    const store2App = await request('/seller/apply', {
      method: 'POST',
      token: seller2Token,
      body: {
        name: `Quantum Dynamics ${ts}`,
        slug: `quantum-dynamics-${ts}`,
        description: 'Quantum Dynamics mechanical keyboards, custom switches, and audiophile gear.',
        category: 'Electronics',
        email: seller2Email,
        phone: '+1 555 444 3333',
        address: '200 Science Park',
        city: 'Austin',
        country: 'United States',
        termsAccepted: true,
      },
    });
    storeId2 = store2App.data?.data?.id;
    await request(`/admin/sellers/${storeId2}/status`, {
      method: 'PATCH',
      token: adminToken,
      body: { status: 'APPROVED' },
    });
    const s2Login = await request('/auth/login', {
      method: 'POST',
      body: { email: seller2Email, password: testPassword },
    });
    seller2Token = s2Login.data?.data?.token;
    assert(!!storeId2 && !!seller2Token, 'Store 2 approved and seller 2 token active');

    // -------------------------------------------------------------
    // 5. Store Operations: Product CRUD & Multi-Vendor Inventory
    // -------------------------------------------------------------
    console.log('\n--- 5. Product Management & Multi-Vendor Inventory ---');

    // Store 1 creates Product 1
    const createP1 = await request('/seller/products', {
      method: 'POST',
      token: applicantToken,
      body: {
        name: `Apex Studio Reference Monitor ${ts}`,
        description: 'Bi-amplified nearfield studio reference monitors.',
        price: 299.99,
        stock: 15,
        image: 'https://images.unsplash.com/photo-1545454675-3531b543be5d',
        categoryId,
      },
    });
    assert(createP1.status === 201, 'Store 1 successfully created product');
    productId1 = createP1.data?.data?.id;
    assert(createP1.data?.data?.storeId === storeId1, 'Product 1 tagged with Store 1 ID');

    // Store 2 creates Product 2
    const createP2 = await request('/seller/products', {
      method: 'POST',
      token: seller2Token,
      body: {
        name: `Quantum Mechanical Keyboard ${ts}`,
        description: 'Gasket-mounted hot-swappable mechanical keyboard.',
        price: 149.99,
        stock: 25,
        image: 'https://images.unsplash.com/photo-1587829741301-dc798b83add3',
        categoryId,
      },
    });
    assert(createP2.status === 201, 'Store 2 successfully created product');
    productId2 = createP2.data?.data?.id;
    assert(createP2.data?.data?.storeId === storeId2, 'Product 2 tagged with Store 2 ID');

    // -------------------------------------------------------------
    // 6. Security: Cross-Seller Data Isolation & Tampering Protection
    // -------------------------------------------------------------
    console.log('\n--- 6. Security: Cross-Seller Data Isolation & Tampering Protection ---');

    // Store 2 attempts to edit Store 1's product -> MUST 403 or 404
    const tamperProduct = await request(`/seller/products/${productId1}`, {
      method: 'PUT',
      token: seller2Token,
      body: { price: 5.0, stock: 999 },
    });
    assert(tamperProduct.status === 403 || tamperProduct.status === 404, 'Cross-seller product edit blocked (HTTP 403/404)');

    // Verify Product 1 price was NOT tampered with
    const verifyP1 = await request(`/products/${productId1}`);
    assert(verifyP1.data?.data?.price === 299.99, 'Product 1 original price intact ($299.99)');

    // Store 2 attempts to delete Store 1's product -> MUST 403 or 404
    const tamperDelete = await request(`/seller/products/${productId1}`, {
      method: 'DELETE',
      token: seller2Token,
    });
    assert(tamperDelete.status === 403 || tamperDelete.status === 404, 'Cross-seller product deletion blocked');

    // -------------------------------------------------------------
    // 7. Multi-Vendor Order Placement, Commission, & Balance Credit
    // -------------------------------------------------------------
    console.log('\n--- 7. Multi-Vendor Order Placement, Commission & Fulfillment ---');

    // Customer places order for Product 1 (from Store 1)
    const checkoutRes = await request('/orders/checkout', {
      method: 'POST',
      token: customerToken,
      body: {
        items: [{ productId: productId1, quantity: 2 }],
        shippingAddress: {
          fullName: 'Sarah Customer',
          phone: '+1 555 111 2222',
          streetAddress: '742 Evergreen Terrace',
          city: 'Springfield',
          postalCode: '97477',
          country: 'United States',
        },
        shippingMethod: 'standard',
        paymentMethod: 'COD',
      },
    });

    if (checkoutRes.status !== 201 && checkoutRes.status !== 200) {
      console.error('Checkout failed with status:', checkoutRes.status, checkoutRes.data);
    }
    assert(checkoutRes.status === 201 || checkoutRes.status === 200, 'Customer order placed successfully');
    const orderCreated = checkoutRes.data?.data?.orders?.[0];
    orderId1 = orderCreated?.id;
    assert(orderCreated?.storeId === storeId1, 'Order properly associated with Store 1');
    assert(orderCreated?.totalPrice === 599.98, 'Total price calculated (2x $299.99 = $599.98)');
    assert(orderCreated?.commissionAmount === 60.0, 'Platform commission 10% calculated ($60.00)');
    assert(orderCreated?.sellerEarnings === 539.98, 'Seller net earnings calculated ($539.98)');

    // Cross-seller order isolation: Store 2 attempts to view Store 1's orders
    const store2Orders = await request('/seller/orders', { token: seller2Token });
    const leakFound = store2Orders.data?.data?.some((o: any) => o.id === orderId1);
    assert(!leakFound, 'Store 2 cannot view Store 1 private customer orders (Cross-tenant isolated)');

    // Store 1 fulfills order through lifecycle: CONFIRMED -> SHIPPED -> DELIVERED
    const confirmStep = await request(`/seller/orders/${orderId1}/status`, {
      method: 'PATCH',
      token: applicantToken,
      body: { status: 'CONFIRMED' },
    });
    assert(confirmStep.data?.data?.status === 'CONFIRMED', 'Order status moved to CONFIRMED');

    const shipStep = await request(`/seller/orders/${orderId1}/status`, {
      method: 'PATCH',
      token: applicantToken,
      body: { status: 'SHIPPED' },
    });
    assert(shipStep.data?.data?.status === 'SHIPPED', 'Order status moved to SHIPPED');

    const deliverStep = await request(`/seller/orders/${orderId1}/status`, {
      method: 'PATCH',
      token: applicantToken,
      body: { status: 'DELIVERED' },
    });
    assert(deliverStep.data?.data?.status === 'DELIVERED', 'Order status moved to DELIVERED');

    // Balance credit check: Store 1 balance updated
    const s1Analytics = await request('/seller/analytics', { token: applicantToken });
    const availableBalance = s1Analytics.data?.data?.metrics?.availableBalance ?? 0;
    assert(availableBalance >= 539.98, `Store 1 balance credited upon delivery: $${availableBalance}`);

    // -------------------------------------------------------------
    // 8. Financial Settlements & Payout Security Limits
    // -------------------------------------------------------------
    console.log('\n--- 8. Financial Settlements & Payout Security Limits ---');

    // Payout limits: Attempt to request more than available balance -> MUST 400
    const excessivePayout = await request('/seller/payouts', {
      method: 'POST',
      token: applicantToken,
      body: {
        amount: availableBalance + 10000,
        paymentMethod: 'Bank Transfer',
        accountInfo: 'Routing: 123456789, Acct: 11223344',
      },
    });
    assert(excessivePayout.status === 400, 'Excessive payout request rejected (HTTP 400 Bad Request)');

    // Valid Payout request within available balance
    const validPayout = await request('/seller/payouts', {
      method: 'POST',
      token: applicantToken,
      body: {
        amount: 200.0,
        paymentMethod: 'Direct Bank Wire',
        accountInfo: 'Chase Bank - Routing: 021000021, Acct: 8877665544',
        notes: 'Bi-weekly earnings distribution',
      },
    });
    assert(validPayout.status === 201, 'Valid payout request created');
    const payoutId = validPayout.data?.data?.id;

    // Admin reviews and approves payout
    const adminPayProcess = await request(`/admin/payouts/${payoutId}`, {
      method: 'PATCH',
      token: adminToken,
      body: { status: 'PAID', notes: 'Settled via Fedwire Ref #FW-20261015' },
    });
    assert(adminPayProcess.data?.data?.status === 'PAID', 'Admin finalized payout settlement to PAID');

    // -------------------------------------------------------------
    // 9. Compliance Enforcement: Suspension & Catalog Protection
    // -------------------------------------------------------------
    console.log('\n--- 9. Compliance Enforcement: Suspension & Catalog Protection ---');

    // Admin suspends Store 1
    const suspendRes = await request(`/admin/sellers/${storeId1}/status`, {
      method: 'PATCH',
      token: adminToken,
      body: { status: 'SUSPENDED', reason: 'Routine seller compliance review.' },
    });
    assert(suspendRes.data?.data?.status === 'SUSPENDED', 'Admin suspended Store 1');

    // Suspended seller blocked from creating new products -> MUST 403
    const blockedProduct = await request('/seller/products', {
      method: 'POST',
      token: applicantToken,
      body: {
        name: 'Blocked Product During Suspension',
        description: 'This product should be blocked because store is suspended',
        price: 50.0,
        stock: 5,
        categoryId,
      },
    });
    assert(blockedProduct.status === 403, 'Suspended seller is blocked from creating products (HTTP 403)');

    // Suspended seller products hidden from public catalog
    const publicCatalog = await request('/products');
    const p1InCatalog = publicCatalog.data?.data?.some((p: any) => p.id === productId1);
    assert(!p1InCatalog, 'Suspended store products hidden from public search/catalog');

    // Admin reinstates Store 1
    const reinstateRes = await request(`/admin/sellers/${storeId1}/status`, {
      method: 'PATCH',
      token: adminToken,
      body: { status: 'APPROVED', reason: 'Compliance review completed and cleared.' },
    });
    assert(reinstateRes.data?.data?.status === 'APPROVED', 'Admin reinstated Store 1 to APPROVED');

    const reinstatedCatalog = await request('/products');
    const p1VisibleAgain = reinstatedCatalog.data?.data?.some((p: any) => p.id === productId1);
    assert(p1VisibleAgain, 'Products restored to catalog once store is reinstated');

    // -------------------------------------------------------------
    // 10. Admin Platform Overview & Audit Trail Integrity
    // -------------------------------------------------------------
    console.log('\n--- 10. Admin Platform Overview & Audit Trail Integrity ---');

    // Admin retrieves audit logs for Store 1
    const auditLogs = await prisma.storeAuditLog.findMany({
      where: { storeId: storeId1 },
      orderBy: { createdAt: 'desc' },
    });
    assert(auditLogs.length >= 3, `Store audit trail recorded (${auditLogs.length} events logged)`);
    const hasSuspendAudit = auditLogs.some((l) => l.toStatus === 'SUSPENDED');
    const hasApproveAudit = auditLogs.some((l) => l.toStatus === 'APPROVED');
    assert(hasSuspendAudit && hasApproveAudit, 'Audit trail contains both SUSPENDED and APPROVED events');

    // Admin platform metrics
    const adminSellersList = await request('/admin/sellers', { token: adminToken });
    assert(adminSellersList.status === 200, 'Admin can view all platform sellers');
    const adminPayoutsList = await request('/admin/payouts', { token: adminToken });
    assert(adminPayoutsList.status === 200, 'Admin can view all platform payouts');

    // -------------------------------------------------------------
    // Summary
    // -------------------------------------------------------------
    console.log('\n════════════════════════════════════════════════════════════════');
    console.log(`  FINAL QA RESULTS: ${passed} Passed, ${failed} Failed`);
    console.log('════════════════════════════════════════════════════════════════\n');

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err: any) {
    console.error('Fatal unhandled error during QA suite execution:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runQASuite();
