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

async function runTests() {
  console.log('🚀 Starting MegaMart Multi-Vendor Seller System Integration Test Suite...\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, errorDetails?: any) {
    if (condition) {
      console.log(`  ✅ [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] ${testName}`, errorDetails || '');
      failed++;
    }
  }

  const timestamp = Date.now();
  const testUserEmail = `applicant_${timestamp}@test.com`;
  const testBuyerEmail = `buyer_${timestamp}@test.com`;
  const testAdminEmail = `admin_${timestamp}@test.com`;
  const testPassword = 'Password123!';

  let userToken = '';
  let userId = '';
  let buyerToken = '';
  let buyerId = '';
  let adminToken = '';
  let adminId = '';
  let storeId = '';
  let productId = '';
  let orderId = '';
  let categoryId = '';

  try {
    // -------------------------------------------------------------
    // Test 1: Health Check & Auth
    // -------------------------------------------------------------
    console.log('--- Phase 1: Environment & Authentication ---');
    const healthRes = await request('http://localhost:5000/health');
    assert(healthRes.data?.success === true, 'Health check returns operational');

    // Register applicant user
    const userRegRes = await request('/auth/register', {
      method: 'POST',
      body: { name: 'Test Applicant', email: testUserEmail, password: testPassword },
    });
    assert(userRegRes.data?.data?.role === 'USER', 'Newly registered applicant has role USER');
    userId = userRegRes.data?.data?.id;

    // Login applicant
    const userLoginRes = await request('/auth/login', {
      method: 'POST',
      body: { email: testUserEmail, password: testPassword },
    });
    userToken = userLoginRes.data?.data?.token;
    assert(!!userToken, 'Applicant successfully logged in and received JWT');

    // Register buyer
    const buyerRegRes = await request('/auth/register', {
      method: 'POST',
      body: { name: 'Test Buyer', email: testBuyerEmail, password: testPassword },
    });
    buyerId = buyerRegRes.data?.data?.id;

    // Login buyer
    const buyerLoginRes = await request('/auth/login', {
      method: 'POST',
      body: { email: testBuyerEmail, password: testPassword },
    });
    buyerToken = buyerLoginRes.data?.data?.token;
    assert(!!buyerToken, 'Buyer successfully logged in and received JWT');

    // Register admin user
    const adminRegRes = await request('/auth/register', {
      method: 'POST',
      body: { name: 'Test Admin', email: testAdminEmail, password: testPassword },
    });
    adminId = adminRegRes.data?.data?.id;

    // Set role to ADMIN in DB for testing
    await prisma.user.update({
      where: { id: adminId },
      data: { role: 'ADMIN' },
    });

    // Login admin
    const adminLoginRes = await request('/auth/login', {
      method: 'POST',
      body: { email: testAdminEmail, password: testPassword },
    });
    adminToken = adminLoginRes.data?.data?.token;
    assert(adminLoginRes.data?.data?.user?.role === 'ADMIN', 'Admin user logged in with role ADMIN');

    // Get an existing category
    const catRes = await request('/categories');
    if (catRes.data?.data && catRes.data.data.length > 0) {
      categoryId = catRes.data.data[0].id;
    } else {
      const newCat = await request('/categories', {
        method: 'POST',
        token: adminToken,
        body: { name: `Cat ${timestamp}`, description: 'Test category' },
      });
      categoryId = newCat.data.data.id;
    }
    assert(!!categoryId, 'Category ID is available for testing');

    // -------------------------------------------------------------
    // Test 2: Seller Application Submission & Pending Restrictions
    // -------------------------------------------------------------
    console.log('\n--- Phase 2: Seller Application & Pending Restrictions ---');
    const storeSlug = `apex-sound-${timestamp}`;
    const applyRes = await request('/seller/apply', {
      method: 'POST',
      token: userToken,
      body: {
        name: `Apex Sound Store ${timestamp}`,
        slug: storeSlug,
        description: 'Premium audiophile studio headphones and high-fidelity sound gear.',
        category: 'Electronics',
        phone: '+1 (555) 234-5678',
        email: `apex_${timestamp}@test.com`,
        address: '742 Evergreen Terrace',
        city: 'Austin',
        country: 'United States',
        taxId: 'TX-98745612',
        verificationDoc: 'https://images.unsplash.com/photo-1544717305-2782549b5136',
        termsAccepted: true,
      },
    });

    storeId = applyRes.data?.data?.id;
    assert(applyRes.data?.data?.status === 'PENDING', 'Application created with status PENDING');
    assert(applyRes.data?.data?.userId === userId, 'Application correctly associated with applicant userId');

    // Verify pending applicant CANNOT create products yet (403 forbidden)
    const productAttempt = await request('/seller/products', {
      method: 'POST',
      token: userToken,
      body: {
        name: 'Unauthorized Product',
        description: 'This should be blocked',
        price: 99.99,
        stock: 10,
        categoryId,
      },
    });
    assert(productAttempt.status === 403, 'Pending applicant is blocked (403) from creating products');

    // Verify applicant can view their application status
    const statusRes = await request('/seller/me', { token: userToken });
    assert(statusRes.data?.data?.status === 'PENDING', 'Applicant can check store status as PENDING');

    // -------------------------------------------------------------
    // Test 3: Admin Review & Decision
    // -------------------------------------------------------------
    console.log('\n--- Phase 3: Admin Decisions & State Transitions ---');
    const adminSellersRes = await request('/admin/sellers?status=PENDING', { token: adminToken });
    const foundInPending = adminSellersRes.data?.data?.sellers?.some((s: any) => s.id === storeId);
    assert(foundInPending, 'Admin can view submitted application in pending reviews');

    // Admin approves the seller
    const approveRes = await request(`/admin/sellers/${storeId}/status`, {
      method: 'PATCH',
      token: adminToken,
      body: { status: 'APPROVED' },
    });
    assert(approveRes.data?.data?.status === 'APPROVED', 'Admin successfully approved store to APPROVED');

    // Verify user role was upgraded to SELLER in DB
    const updatedUser = await prisma.user.findUnique({ where: { id: userId } });
    assert(updatedUser?.role === 'SELLER', 'Applicant user role was automatically upgraded to SELLER');

    // Re-login seller to get refreshed JWT with SELLER role
    const sellerRelogin = await request('/auth/login', {
      method: 'POST',
      body: { email: testUserEmail, password: testPassword },
    });
    userToken = sellerRelogin.data?.data?.token;

    // Verify seller store is now active
    const sellerStoreRes = await request('/seller/me', { token: userToken });
    assert(sellerStoreRes.data?.data?.status === 'APPROVED', 'Seller store is now APPROVED in state');

    // Verify notification was sent to applicant
    const notifRes = await request('/notifications', { token: userToken });
    const hasApprovalNotif = notifRes.data?.data?.some((n: any) => n.title.includes('Approved'));
    assert(hasApprovalNotif, 'Store owner received notification of approval');

    // -------------------------------------------------------------
    // Test 4: Approved Seller Product Management & Ownership
    // -------------------------------------------------------------
    console.log('\n--- Phase 4: Approved Seller Product & Catalog Integrity ---');
    const newProductRes = await request('/seller/products', {
      method: 'POST',
      token: userToken,
      body: {
        name: `Aura Pro Studio Headphones ${timestamp}`,
        description: 'Professional open-back reference headphones with beryllium drivers.',
        price: 249.99,
        stock: 25,
        image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e',
        categoryId,
      },
    });
    productId = newProductRes.data?.data?.id;
    assert(newProductRes.data?.data?.storeId === storeId, 'Product created and linked to seller storeId');

    // Seller updates their product
    const updateProdRes = await request(`/seller/products/${productId}`, {
      method: 'PUT',
      token: userToken,
      body: { price: 229.99, stock: 30 },
    });
    assert(updateProdRes.data?.data?.price === 229.99, 'Seller successfully updated product price');
    assert(updateProdRes.data?.data?.stock === 30, 'Seller successfully updated product stock');

    // Cross-seller tampering protection: buyer/other user cannot edit this product
    const tamperAttempt = await request(`/seller/products/${productId}`, {
      method: 'PUT',
      token: buyerToken,
      body: { price: 1.0 },
    });
    assert(tamperAttempt.status === 403, 'Non-owner is prevented (403) from modifying another seller product');

    // Verify public product listing includes store information
    const publicProductRes = await request(`/products/${productId}`);
    assert(publicProductRes.data?.data?.store?.id === storeId, 'Public product API includes store details');
    assert(publicProductRes.data?.data?.store?.name?.includes('Apex Sound'), 'Public product includes store name');

    // -------------------------------------------------------------
    // Test 5: Multi-Vendor Orders, Fulfillment, & Financials
    // -------------------------------------------------------------
    console.log('\n--- Phase 5: Multi-Vendor Checkout, Commissions & Earnings ---');
    const checkoutRes = await request('/orders/checkout', {
      method: 'POST',
      token: buyerToken,
      body: {
        items: [{ productId, quantity: 2 }],
        shippingAddress: {
          fullName: 'Test Buyer Customer',
          phone: '+1 555 999 8888',
          streetAddress: '123 Market Street',
          city: 'San Francisco',
          postalCode: '94105',
          country: 'United States',
        },
        shippingMethod: 'standard',
        paymentMethod: 'COD',
      },
    });

    const orderCreated = checkoutRes.data?.data?.orders?.[0];
    orderId = orderCreated?.id;
    assert(orderCreated?.storeId === storeId, 'Checkout automatically tagged order with seller storeId');
    assert(orderCreated?.totalPrice === 459.98, 'Total price calculated correctly (2x $229.99 = $459.98)');
    assert(orderCreated?.commissionAmount === 46.0, 'Platform commission computed correctly (10% = $46.00)');
    assert(orderCreated?.sellerEarnings === 413.98, 'Seller net earnings computed correctly ($413.98)');

    // Seller views their orders
    const sellerOrdersRes = await request('/seller/orders', { token: userToken });
    const foundOrder = sellerOrdersRes.data?.data?.some((o: any) => o.id === orderId);
    assert(foundOrder, 'Seller can view orders placed for their store');

    // Cross-seller order isolation: buyer cannot access seller fulfillment route
    const buyerOrderAttempt = await request('/seller/orders', { token: buyerToken });
    assert(buyerOrderAttempt.status === 403, 'Standard customer is blocked (403) from seller order routes');

    // Seller fulfills order: CONFIRMED -> SHIPPED -> DELIVERED
    await request(`/seller/orders/${orderId}/status`, {
      method: 'PATCH',
      token: userToken,
      body: { status: 'CONFIRMED' },
    });
    await request(`/seller/orders/${orderId}/status`, {
      method: 'PATCH',
      token: userToken,
      body: { status: 'SHIPPED' },
    });
    const deliveredRes = await request(`/seller/orders/${orderId}/status`, {
      method: 'PATCH',
      token: userToken,
      body: { status: 'DELIVERED' },
    });
    assert(deliveredRes.data?.data?.status === 'DELIVERED', 'Seller successfully marked order DELIVERED');

    // Verify seller balance was credited upon delivery
    const analyticsRes = await request('/seller/analytics', { token: userToken });
    assert(analyticsRes.data?.data?.metrics?.availableBalance >= 413.98, 'Available balance credited with earnings ($413.98+)');
    assert(analyticsRes.data?.data?.metrics?.grossSales >= 459.98, 'Gross sales metrics reflect order total ($459.98+)');

    // -------------------------------------------------------------
    // Test 6: Payout Request & Processing
    // -------------------------------------------------------------
    console.log('\n--- Phase 6: Payout Requests & Administrative Settlement ---');
    const payoutReqRes = await request('/seller/payouts', {
      method: 'POST',
      token: userToken,
      body: {
        amount: 100.0,
        paymentMethod: 'Bank Wire Transfer',
        accountInfo: 'Routing: 121000358, Acct: 9988776655',
        notes: 'Monthly regular settlement',
      },
    });
    const payoutId = payoutReqRes.data?.data?.id;
    assert(payoutReqRes.data?.data?.status === 'PENDING', 'Payout request created with status PENDING');
    assert(payoutReqRes.data?.data?.amount === 100.0, 'Payout amount is $100.00');

    // Admin views payout requests
    const adminPayoutsRes = await request('/admin/payouts?status=PENDING', { token: adminToken });
    const foundPayout = adminPayoutsRes.data?.data?.some((p: any) => p.id === payoutId);
    assert(foundPayout, 'Admin can view submitted payout request');

    // Admin approves & finalizes payout
    const processPayoutRes = await request(`/admin/payouts/${payoutId}`, {
      method: 'PATCH',
      token: adminToken,
      body: { status: 'PAID', notes: 'Wire transfer transaction ref #WT-894103' },
    });
    assert(processPayoutRes.data?.data?.status === 'PAID', 'Admin finalized payout to PAID');

    // -------------------------------------------------------------
    // Test 7: Store Suspension & Catalog Protection
    // -------------------------------------------------------------
    console.log('\n--- Phase 7: Compliance Suspension & Catalog Protection ---');
    await request(`/admin/sellers/${storeId}/status`, {
      method: 'PATCH',
      token: adminToken,
      body: { status: 'SUSPENDED', reason: 'Routine compliance audit hold' },
    });

    // Suspended seller is blocked from creating products
    const suspendedAttempt = await request('/seller/products', {
      method: 'POST',
      token: userToken,
      body: {
        name: 'Suspended Attempt',
        description: 'Cannot post while suspended',
        price: 50.0,
        stock: 5,
        categoryId,
      },
    });
    assert(suspendedAttempt.status === 403, 'Suspended seller is blocked (403) from creating products');

    // Suspended seller products are hidden from public catalog
    const catalogRes = await request('/products');
    const suspendedProdVisible = catalogRes.data?.data?.some((p: any) => p.id === productId);
    assert(!suspendedProdVisible, 'Suspended seller product is hidden from public catalog search');

    // Admin re-activates store
    await request(`/admin/sellers/${storeId}/status`, {
      method: 'PATCH',
      token: adminToken,
      body: { status: 'APPROVED' },
    });
    const reactivatedCatalogRes = await request('/products');
    const reactivatedProdVisible = reactivatedCatalogRes.data?.data?.some((p: any) => p.id === productId);
    assert(reactivatedProdVisible, 'Product becomes visible again once store is re-approved');

    // -------------------------------------------------------------
    // Summary
    // -------------------------------------------------------------
    console.log(`\n========================================`);
    console.log(`🏁 Multi-Vendor Test Results: ${passed} Passed, ${failed} Failed`);
    console.log(`========================================\n`);

    if (failed > 0) {
      process.exit(1);
    }
  } catch (error: any) {
    console.error('Fatal test execution error:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runTests();
