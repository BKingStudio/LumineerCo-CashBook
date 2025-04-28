let currentUser = null;
let isPremiumUser = false;
const SHEETDB_API_URL = 'https://sheetdb.io/api/v1/da2hzo9xqrml4';
const CASHBOOK_KEY = 'LumineerCo_CashBook';

document.addEventListener('DOMContentLoaded', function() {
    initApp();
    
    setupEventListeners();
    
    checkLoginStatus();
});

function initApp() {
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('transactionDate').value = today;
    document.getElementById('invoiceDate').value = today;
    document.getElementById('transactionDateFilter').value = today;
    document.getElementById('salesReportFromDate').value = getFirstDayOfMonth();
    document.getElementById('salesReportToDate').value = today;
    document.getElementById('expenseReportFromDate').value = getFirstDayOfMonth();
    document.getElementById('expenseReportToDate').value = today;
    document.getElementById('plReportFromDate').value = getFirstDayOfMonth();
    document.getElementById('plReportToDate').value = today;
}

function setupEventListeners() {
    document.getElementById('loginForm').addEventListener('submit', handleLogin);
    document.getElementById('registerForm').addEventListener('submit', handleRegister);
    document.getElementById('logoutBtn').addEventListener('click', handleLogout);
    
    document.querySelectorAll('[data-section]').forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            showSection(this.getAttribute('data-section'));
        });
    });
    
    document.getElementById('addTransactionBtn').addEventListener('click', showAddTransactionModal);
    document.getElementById('saveTransactionBtn').addEventListener('click', saveTransaction);
    document.getElementById('filterTransactionsBtn').addEventListener('click', filterTransactions);
    document.getElementById('resetTransactionFilterBtn').addEventListener('click', resetTransactionFilter);
    
    document.getElementById('addInventoryBtn').addEventListener('click', showAddInventoryModal);
    document.getElementById('saveInventoryBtn').addEventListener('click', saveInventoryItem);
    
    document.getElementById('addCustomerBtn').addEventListener('click', () => showAddContactModal('customer'));
    document.getElementById('addSupplierBtn').addEventListener('click', () => showAddContactModal('supplier'));
    document.getElementById('saveContactBtn').addEventListener('click', saveContact);
    
    document.getElementById('newInvoiceBtn').addEventListener('click', showInvoiceForm);
    document.getElementById('addInvoiceItemBtn').addEventListener('click', addInvoiceItemRow);
    document.getElementById('invoiceForm').addEventListener('submit', saveInvoice);
    document.getElementById('printInvoiceBtn').addEventListener('click', printInvoice);
    document.getElementById('printInvoiceModalBtn').addEventListener('click', printInvoiceModal);
    
    document.getElementById('generateSalesReportBtn').addEventListener('click', generateSalesReport);
    document.getElementById('generateExpenseReportBtn').addEventListener('click', generateExpenseReport);
    document.getElementById('generatePLReportBtn').addEventListener('click', generateProfitLossReport);
    document.getElementById('generateInventoryReportBtn').addEventListener('click', generateInventoryReport);
    
    document.getElementById('profileForm').addEventListener('submit', updateProfile);
    document.getElementById('passwordForm').addEventListener('submit', changePassword);
    
    document.getElementById('subscribeMonthlyBtn').addEventListener('click', () => showSubscriptionModal('monthly'));
    document.getElementById('subscribeYearlyBtn').addEventListener('click', () => showSubscriptionModal('yearly'));
    document.getElementById('subscribeLifetimeBtn').addEventListener('click', () => showSubscriptionModal('lifetime'));
    
    document.addEventListener('input', function(e) {
        if (e.target.classList.contains('invoice-quantity') || 
            e.target.classList.contains('invoice-price') ||
            e.target.classList.contains('invoice-gst')) {
            calculateInvoiceItemTotal(e.target.closest('tr'));
        }
    });
    
    document.getElementById('confirmActionBtn').addEventListener('click', confirmAction);
}

function getFirstDayOfMonth() {
    const date = new Date();
    return new Date(date.getFullYear(), date.getMonth(), 1).toISOString().split('T')[0];
}

function formatDate(dateStr) {
    const options = { year: 'numeric', month: 'short', day: 'numeric' };
    return new Date(dateStr).toLocaleDateString(undefined, options);
}

function formatCurrency(amount) {
    return '₹' + parseFloat(amount).toFixed(2).replace(/\d(?=(\d{3})+\.)/g, '$&,');
}

function showAlert(message, type = 'success') {
    const alert = document.createElement('div');
    alert.className = `alert alert-${type} alert-dismissible fade show`;
    alert.role = 'alert';
    alert.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    `;
    
    const container = document.querySelector('.main-content');
    container.prepend(alert);
    
    setTimeout(() => {
        alert.classList.remove('show');
        setTimeout(() => alert.remove(), 150);
    }, 3000);
}

function showSection(sectionId) {
    document.querySelectorAll('.app-section').forEach(section => {
        section.style.display = 'none';
    });
    
    const section = document.getElementById(`${sectionId}Section`);
    if (section) {
        section.style.display = 'block';
        
        switch(sectionId) {
            case 'dashboard':
                loadDashboardData();
                break;
            case 'transactions':
                loadTransactions();
                break;
            case 'inventory':
                loadInventory();
                break;
            case 'contacts':
                loadContacts();
                break;
            case 'billing':
                loadInvoices();
                loadCustomersForInvoice();
                loadItemsForInvoice();
                break;
            case 'reports':
                generateSalesReport();
                break;
            case 'profile':
                loadProfile();
                break;
        }
    }
}

function checkLoginStatus() {
    const userData = localStorage.getItem(CASHBOOK_KEY);
    if (userData) {
        try {
            const data = JSON.parse(userData);
            if (data.user && data.user.username) {
                currentUser = data.user;
                isPremiumUser = data.subscription && data.subscription.active;
                setupLoggedInUI();
                loadDashboardData();
                return;
            }
        } catch (e) {
            console.error('Error parsing user data:', e);
        }
    }
    setupLoggedOutUI();
}

async function handleLogin(e) {
    e.preventDefault();
    
    const username = document.getElementById('loginUsername').value;
    const password = document.getElementById('loginPassword').value;
    
    try {
        const response = await axios.get(`${SHEETDB_API_URL}/search?username=${encodeURIComponent(username)}`);
        
        if (response.data.length === 0) {
            showAlert('Username not found', 'danger');
            return;
        }
        
        const user = response.data[0];
        if (user.password !== password) {
            showAlert('Incorrect password', 'danger');
            return;
        }
        
        currentUser = user;
        
        let localData = localStorage.getItem(`${CASHBOOK_KEY}_${username}`);
        if (!localData) {
            localData = {
                user: user,
                transactions: [],
                inventory: [],
                customers: [],
                suppliers: [],
                invoices: [],
                subscription: { active: false }
            };
            localStorage.setItem(`${CASHBOOK_KEY}_${username}`, JSON.stringify(localData));
        } else {
            localData = JSON.parse(localData);
            localData.user = user;
            localStorage.setItem(`${CASHBOOK_KEY}_${username}`, JSON.stringify(localData));
        }
        
        localStorage.setItem(CASHBOOK_KEY, JSON.stringify(localData));
        isPremiumUser = localData.subscription && localData.subscription.active;
        
        setupLoggedInUI();
        showAlert('Login successful!', 'success');
        loadDashboardData();
        
    } catch (error) {
        console.error('Login error:', error);
        showAlert('An error occurred during login', 'danger');
    }
}

async function handleRegister(e) {
    e.preventDefault();
    
    const userData = {
        username: document.getElementById('regUsername').value,
        password: document.getElementById('regPassword').value,
        owner_name: document.getElementById('ownerName').value,
        business_name: document.getElementById('businessName').value,
        contact_number: document.getElementById('contactNumber').value,
        email: document.getElementById('email').value || '',
        gstin: document.getElementById('gstin').value || '',
        address: document.getElementById('address').value || '',
        created_at: new Date().toISOString()
    };
    
    try {
        const checkResponse = await axios.get(`${SHEETDB_API_URL}/search?username=${encodeURIComponent(userData.username)}`);
        if (checkResponse.data.length > 0) {
            showAlert('Username already exists', 'danger');
            return;
        }
        
        await axios.post(SHEETDB_API_URL, {
            data: [userData]
        });
        
        const localData = {
            user: userData,
            transactions: [],
            inventory: [],
            customers: [],
            suppliers: [],
            invoices: [],
            subscription: { active: false }
        };
        
        localStorage.setItem(`${CASHBOOK_KEY}_${userData.username}`, JSON.stringify(localData));
        
        showAlert('Registration successful! Please login.', 'success');
        document.getElementById('login-tab').click();
        document.getElementById('registerForm').reset();
        
    } catch (error) {
        console.error('Registration error:', error);
        showAlert('An error occurred during registration', 'danger');
    }
}

function handleLogout() {
    currentUser = null;
    localStorage.removeItem(CASHBOOK_KEY);
    setupLoggedOutUI();
    showAlert('Logged out successfully', 'success');
}

function setupLoggedInUI() {
    document.getElementById('authSection').style.display = 'none';
    document.getElementById('appSections').style.display = 'block';
    document.getElementById('usernameDisplay').textContent = currentUser.username;
    
    document.getElementById('adBanner').style.display = isPremiumUser ? 'none' : 'block';
    
    showSection('dashboard');
}

function setupLoggedOutUI() {
    document.getElementById('authSection').style.display = 'block';
    document.getElementById('appSections').style.display = 'none';
    document.getElementById('loginForm').reset();
    document.getElementById('usernameDisplay').textContent = 'Guest';
}

function getUserData() {
    if (!currentUser) return null;
    const data = localStorage.getItem(`${CASHBOOK_KEY}_${currentUser.username}`);
    return data ? JSON.parse(data) : null;
}

function saveUserData(data) {
    if (!currentUser) return;
    localStorage.setItem(`${CASHBOOK_KEY}_${currentUser.username}`, JSON.stringify(data));
    localStorage.setItem(CASHBOOK_KEY, JSON.stringify(data));
}

function loadDashboardData() {
    const userData = getUserData();
    if (!userData) return;
    
    let totalIncome = 0;
    let totalExpenses = 0;
    let todaySales = 0;
    const today = new Date().toISOString().split('T')[0];
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    
    userData.transactions.forEach(t => {
        const amount = parseFloat(t.amount);
        const tDate = new Date(t.date);
        
        if (t.type === 'income') {
            totalIncome += amount;
            
            if (t.date === today) {
                todaySales += amount;
            }
            
            if (tDate.getMonth() === currentMonth && tDate.getFullYear() === currentYear) {
            }
        } else if (t.type === 'expense') {
            totalExpenses += amount;
        }
    });
    
    userData.invoices.forEach(inv => {
        const invDate = new Date(inv.date);
        if (inv.status === 'paid' || inv.status === 'partial') {
            const paidAmount = parseFloat(inv.amount_paid) || 0;
            
            if (inv.date === today) {
                todaySales += paidAmount;
            }
            
            if (invDate.getMonth() === currentMonth && invDate.getFullYear() === currentYear) {
            }
        }
    });
    
    let lowStockCount = 0;
    userData.inventory.forEach(item => {
        if (item.alert_level && parseInt(item.current_stock) <= parseInt(item.alert_level)) {
            lowStockCount++;
        }
    });
    
    document.getElementById('totalSales').textContent = formatCurrency(totalIncome);
    document.getElementById('totalExpenses').textContent = formatCurrency(totalExpenses);
    document.getElementById('netProfit').textContent = formatCurrency(totalIncome - totalExpenses);
    document.getElementById('todaySales').textContent = formatCurrency(todaySales);
    document.getElementById('monthlySales').textContent = formatCurrency(totalIncome); // Simplified for demo
    document.getElementById('stockAlerts').textContent = lowStockCount;
    
    const recentTransactions = [...userData.transactions]
        .sort((a, b) => new Date(b.date) - new Date(a.date))
        .slice(0, 5);
    
    const transactionsTable = document.getElementById('recentTransactionsTable').querySelector('tbody');
    transactionsTable.innerHTML = '';
    
    recentTransactions.forEach(t => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${formatDate(t.date)}</td>
            <td>${t.description || '-'}</td>
            <td>${formatCurrency(t.amount)}</td>
            <td><span class="badge ${t.type === 'income' ? 'bg-success' : 'bg-danger'}">${t.type}</span></td>
        `;
        transactionsTable.appendChild(row);
    });
    
    const lowStockTable = document.getElementById('lowStockTable').querySelector('tbody');
    lowStockTable.innerHTML = '';
    
    userData.inventory.forEach(item => {
        if (item.alert_level && parseInt(item.current_stock) <= parseInt(item.alert_level)) {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${item.name}</td>
                <td>${item.current_stock}</td>
                <td>${item.alert_level}</td>
            `;
            lowStockTable.appendChild(row);
        }
    });
}

function loadTransactions(filter = {}) {
    const userData = getUserData();
    if (!userData) return;
    
    let transactions = [...userData.transactions];
    
    if (filter.date) {
        transactions = transactions.filter(t => t.date === filter.date);
    }
    
    if (filter.type) {
        transactions = transactions.filter(t => t.type === filter.type);
    }
    
    transactions.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    const transactionsTable = document.getElementById('transactionsTable').querySelector('tbody');
    transactionsTable.innerHTML = '';
    
    transactions.forEach(t => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${formatDate(t.date)}</td>
            <td>${t.description || '-'}</td>
            <td>${formatCurrency(t.amount)}</td>
            <td><span class="badge ${t.type === 'income' ? 'bg-success' : 'bg-danger'}">${t.type}</span></td>
            <td>${t.category || '-'}</td>
            <td>
                <button class="btn btn-sm btn-warning edit-transaction" data-id="${t.id}"><i class="fas fa-edit"></i></button>
                <button class="btn btn-sm btn-danger delete-transaction" data-id="${t.id}"><i class="fas fa-trash"></i></button>
            </td>
        `;
        transactionsTable.appendChild(row);
    });
    
    document.querySelectorAll('.edit-transaction').forEach(btn => {
        btn.addEventListener('click', () => editTransaction(btn.dataset.id));
    });
    
    document.querySelectorAll('.delete-transaction').forEach(btn => {
        btn.addEventListener('click', () => confirmDelete('transaction', btn.dataset.id));
    });
}

function showAddTransactionModal() {
    document.getElementById('transactionModalTitle').textContent = 'Add Transaction';
    document.getElementById('transactionForm').reset();
    document.getElementById('transactionId').value = '';
    document.getElementById('transactionDate').value = new Date().toISOString().split('T')[0];
    
    const categorySelect = document.getElementById('transactionCategory');
    categorySelect.innerHTML = `
        <option value="">Select Category</option>
        <option value="sale">Sale</option>
        <option value="service">Service</option>
        <option value="other_income">Other Income</option>
        <option value="purchase">Purchase</option>
        <option value="salary">Salary</option>
        <option value="rent">Rent</option>
        <option value="utilities">Utilities</option>
        <option value="other_expense">Other Expense</option>
    `;
    
    const modal = new bootstrap.Modal(document.getElementById('transactionModal'));
    modal.show();
}

function saveTransaction() {
    const form = document.getElementById('transactionForm');
    if (!form.checkValidity()) {
        form.classList.add('was-validated');
        return;
    }
    
    const userData = getUserData();
    if (!userData) return;
    
    const transactionId = document.getElementById('transactionId').value;
    const transactionData = {
        date: document.getElementById('transactionDate').value,
        type: document.getElementById('transactionType').value,
        category: document.getElementById('transactionCategory').value,
        amount: parseFloat(document.getElementById('transactionAmount').value).toFixed(2),
        description: document.getElementById('transactionDescription').value,
        payment_method: document.getElementById('transactionPaymentMethod').value,
        id: transactionId || Date.now().toString()
    };
    
    if (transactionId) {
        const index = userData.transactions.findIndex(t => t.id === transactionId);
        if (index !== -1) {
            userData.transactions[index] = transactionData;
        }
    } else {
        userData.transactions.push(transactionData);
    }
    
    saveUserData(userData);
    
    const modal = bootstrap.Modal.getInstance(document.getElementById('transactionModal'));
    modal.hide();
    
    showAlert(`Transaction ${transactionId ? 'updated' : 'added'} successfully!`);
    loadTransactions();
    loadDashboardData();
}

function editTransaction(id) {
    const userData = getUserData();
    if (!userData) return;
    
    const transaction = userData.transactions.find(t => t.id === id);
    if (!transaction) return;
    
    document.getElementById('transactionModalTitle').textContent = 'Edit Transaction';
    document.getElementById('transactionId').value = transaction.id;
    document.getElementById('transactionDate').value = transaction.date;
    document.getElementById('transactionType').value = transaction.type;
    document.getElementById('transactionCategory').value = transaction.category;
    document.getElementById('transactionAmount').value = transaction.amount;
    document.getElementById('transactionDescription').value = transaction.description || '';
    document.getElementById('transactionPaymentMethod').value = transaction.payment_method || 'cash';
    
    const modal = new bootstrap.Modal(document.getElementById('transactionModal'));
    modal.show();
}

function filterTransactions() {
    const date = document.getElementById('transactionDateFilter').value;
    const type = document.getElementById('transactionTypeFilter').value;
    
    loadTransactions({ date, type });
}

function resetTransactionFilter() {
    document.getElementById('transactionDateFilter').value = '';
    document.getElementById('transactionTypeFilter').value = '';
    loadTransactions();
}

function loadInventory() {
    const userData = getUserData();
    if (!userData) return;
    
    const inventoryTable = document.getElementById('inventoryTable').querySelector('tbody');
    inventoryTable.innerHTML = '';
    
    userData.inventory.forEach(item => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${item.name}</td>
            <td>${item.sku || '-'}</td>
            <td>${formatCurrency(item.price)}</td>
            <td>${item.current_stock}</td>
            <td>${item.alert_level || '-'}</td>
            <td>
                <button class="btn btn-sm btn-warning edit-inventory" data-id="${item.id}"><i class="fas fa-edit"></i></button>
                <button class="btn btn-sm btn-danger delete-inventory" data-id="${item.id}"><i class="fas fa-trash"></i></button>
            </td>
        `;
        inventoryTable.appendChild(row);
    });
    
    document.querySelectorAll('.edit-inventory').forEach(btn => {
        btn.addEventListener('click', () => editInventoryItem(btn.dataset.id));
    });
    
    document.querySelectorAll('.delete-inventory').forEach(btn => {
        btn.addEventListener('click', () => confirmDelete('inventory', btn.dataset.id));
    });
}

function showAddInventoryModal() {
    document.getElementById('inventoryModalTitle').textContent = 'Add Inventory Item';
    document.getElementById('inventoryForm').reset();
    document.getElementById('inventoryItemId').value = '';
    
    const modal = new bootstrap.Modal(document.getElementById('inventoryModal'));
    modal.show();
}

function saveInventoryItem() {
    const form = document.getElementById('inventoryForm');
    if (!form.checkValidity()) {
        form.classList.add('was-validated');
        return;
    }
    
    const userData = getUserData();
    if (!userData) return;
    
    const itemId = document.getElementById('inventoryItemId').value;
    const inventoryData = {
        name: document.getElementById('itemName').value,
        sku: document.getElementById('itemSku').value || '',
        price: parseFloat(document.getElementById('itemPrice').value).toFixed(2),
        cost: document.getElementById('itemCost').value ? parseFloat(document.getElementById('itemCost').value).toFixed(2) : '',
        current_stock: parseInt(document.getElementById('itemStock').value),
        alert_level: document.getElementById('itemAlertLevel').value ? parseInt(document.getElementById('itemAlertLevel').value) : '',
        description: document.getElementById('itemDescription').value || '',
        id: itemId || Date.now().toString()
    };
    
    if (itemId) {
        const index = userData.inventory.findIndex(i => i.id === itemId);
        if (index !== -1) {
            userData.inventory[index] = inventoryData;
        }
    } else {
        userData.inventory.push(inventoryData);
    }
    
    saveUserData(userData);
    
    const modal = bootstrap.Modal.getInstance(document.getElementById('inventoryModal'));
    modal.hide();
    
    showAlert(`Inventory item ${itemId ? 'updated' : 'added'} successfully!`);
    loadInventory();
    loadDashboardData();
}

function editInventoryItem(id) {
    const userData = getUserData();
    if (!userData) return;
    
    const item = userData.inventory.find(i => i.id === id);
    if (!item) return;
    
    document.getElementById('inventoryModalTitle').textContent = 'Edit Inventory Item';
    document.getElementById('inventoryItemId').value = item.id;
    document.getElementById('itemName').value = item.name;
    document.getElementById('itemSku').value = item.sku || '';
    document.getElementById('itemPrice').value = item.price;
    document.getElementById('itemCost').value = item.cost || '';
    document.getElementById('itemStock').value = item.current_stock;
    document.getElementById('itemAlertLevel').value = item.alert_level || '';
    document.getElementById('itemDescription').value = item.description || '';
    
    const modal = new bootstrap.Modal(document.getElementById('inventoryModal'));
    modal.show();
}

function loadContacts() {
    const userData = getUserData();
    if (!userData) return;
    
    const customersTable = document.getElementById('customersTable').querySelector('tbody');
    customersTable.innerHTML = '';
    
    userData.customers.forEach(customer => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${customer.name}</td>
            <td>${customer.phone || '-'}</td>
            <td>${customer.email || '-'}</td>
            <td>${formatCurrency(customer.balance || 0)}</td>
            <td>
                <button class="btn btn-sm btn-warning edit-contact" data-id="${customer.id}" data-type="customer"><i class="fas fa-edit"></i></button>
                <button class="btn btn-sm btn-danger delete-contact" data-id="${customer.id}" data-type="customer"><i class="fas fa-trash"></i></button>
            </td>
        `;
        customersTable.appendChild(row);
    });
    
    const suppliersTable = document.getElementById('suppliersTable').querySelector('tbody');
    suppliersTable.innerHTML = '';
    
    userData.suppliers.forEach(supplier => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${supplier.name}</td>
            <td>${supplier.phone || '-'}</td>
            <td>${supplier.email || '-'}</td>
            <td>${formatCurrency(supplier.balance || 0)}</td>
            <td>
                <button class="btn btn-sm btn-warning edit-contact" data-id="${supplier.id}" data-type="supplier"><i class="fas fa-edit"></i></button>
                <button class="btn btn-sm btn-danger delete-contact" data-id="${supplier.id}" data-type="supplier"><i class="fas fa-trash"></i></button>
            </td>
        `;
        suppliersTable.appendChild(row);
    });
    
    document.querySelectorAll('.edit-contact').forEach(btn => {
        btn.addEventListener('click', () => editContact(btn.dataset.id, btn.dataset.type));
    });
    
    document.querySelectorAll('.delete-contact').forEach(btn => {
        btn.addEventListener('click', () => confirmDelete('contact', btn.dataset.id, btn.dataset.type));
    });
}

function showAddContactModal(type) {
    const title = type === 'customer' ? 'Add Customer' : 'Add Supplier';
    document.getElementById('contactModalTitle').textContent = title;
    document.getElementById('contactForm').reset();
    document.getElementById('contactId').value = '';
    document.getElementById('contactType').value = type;
    document.getElementById('contactOpeningBalance').value = '0';
    
    const modal = new bootstrap.Modal(document.getElementById('contactModal'));
    modal.show();
}

function saveContact() {
    const form = document.getElementById('contactForm');
    if (!form.checkValidity()) {
        form.classList.add('was-validated');
        return;
    }
    
    const userData = getUserData();
    if (!userData) return;
    
    const contactId = document.getElementById('contactId').value;
    const contactType = document.getElementById('contactType').value;
    const contactData = {
        name: document.getElementById('contactName').value,
        phone: document.getElementById('contactPhone').value || '',
        email: document.getElementById('contactEmail').value || '',
        address: document.getElementById('contactAddress').value || '',
        gstin: document.getElementById('contactGstin').value || '',
        balance: parseFloat(document.getElementById('contactOpeningBalance').value).toFixed(2),
        id: contactId || Date.now().toString()
    };
    
    const collection = contactType === 'customer' ? 'customers' : 'suppliers';
    
    if (contactId) {
        const index = userData[collection].findIndex(c => c.id === contactId);
        if (index !== -1) {
            userData[collection][index] = contactData;
        }
    } else {
        userData[collection].push(contactData);
    }
    
    saveUserData(userData);
    
    const modal = bootstrap.Modal.getInstance(document.getElementById('contactModal'));
    modal.hide();
    
    showAlert(`${contactType === 'customer' ? 'Customer' : 'Supplier'} ${contactId ? 'updated' : 'added'} successfully!`);
    loadContacts();
}

function editContact(id, type) {
    const userData = getUserData();
    if (!userData) return;
    
    const collection = type === 'customer' ? 'customers' : 'suppliers';
    const contact = userData[collection].find(c => c.id === id);
    if (!contact) return;
    
    const title = type === 'customer' ? 'Edit Customer' : 'Edit Supplier';
    document.getElementById('contactModalTitle').textContent = title;
    document.getElementById('contactId').value = contact.id;
    document.getElementById('contactType').value = type;
    document.getElementById('contactName').value = contact.name;
    document.getElementById('contactPhone').value = contact.phone || '';
    document.getElementById('contactEmail').value = contact.email || '';
    document.getElementById('contactAddress').value = contact.address || '';
    document.getElementById('contactGstin').value = contact.gstin || '';
    document.getElementById('contactOpeningBalance').value = contact.balance || '0';
    
    const modal = new bootstrap.Modal(document.getElementById('contactModal'));
    modal.show();
}

function loadInvoices() {
    const userData = getUserData();
    if (!userData) return;
    
    const invoicesTable = document.getElementById('invoicesTable').querySelector('tbody');
    invoicesTable.innerHTML = '';
    
    const sortedInvoices = [...userData.invoices].sort((a, b) => new Date(b.date) - new Date(a.date));
    
    sortedInvoices.forEach(invoice => {
        const total = parseFloat(invoice.total_amount).toFixed(2);
        const paid = parseFloat(invoice.amount_paid || 0).toFixed(2);
        const due = (total - paid).toFixed(2);
        
        let statusBadge;
        if (paid >= total) {
            statusBadge = '<span class="badge bg-success">Paid</span>';
        } else if (paid > 0) {
            statusBadge = '<span class="badge bg-warning">Partial</span>';
        } else {
            statusBadge = '<span class="badge bg-danger">Unpaid</span>';
        }
        
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${invoice.invoice_number}</td>
            <td>${formatDate(invoice.date)}</td>
            <td>${invoice.customer_name}</td>
            <td>${formatCurrency(total)}</td>
            <td>${formatCurrency(paid)}</td>
            <td>${statusBadge}</td>
            <td>
                <button class="btn btn-sm btn-info view-invoice" data-id="${invoice.id}"><i class="fas fa-eye"></i></button>
                <button class="btn btn-sm btn-warning edit-invoice" data-id="${invoice.id}"><i class="fas fa-edit"></i></button>
                <button class="btn btn-sm btn-danger delete-invoice" data-id="${invoice.id}"><i class="fas fa-trash"></i></button>
            </td>
        `;
        invoicesTable.appendChild(row);
    });
    
    document.querySelectorAll('.view-invoice').forEach(btn => {
        btn.addEventListener('click', () => viewInvoice(btn.dataset.id));
    });
    
    document.querySelectorAll('.edit-invoice').forEach(btn => {
        btn.addEventListener('click', () => editInvoice(btn.dataset.id));
    });
    
    document.querySelectorAll('.delete-invoice').forEach(btn => {
        btn.addEventListener('click', () => confirmDelete('invoice', btn.dataset.id));
    });
}

function loadCustomersForInvoice() {
    const userData = getUserData();
    if (!userData) return;
    
    const select = document.getElementById('invoiceCustomer');
    select.innerHTML = '<option value="">Select Customer</option>';
    
    userData.customers.forEach(customer => {
        const option = document.createElement('option');
        option.value = customer.id;
        option.textContent = customer.name;
        select.appendChild(option);
    });
}

function loadItemsForInvoice() {
    const userData = getUserData();
    if (!userData) return;
    
    const selects = document.querySelectorAll('.invoice-item');
    selects.forEach(select => {
        const currentValue = select.value;
        select.innerHTML = '<option value="">Select Item</option>';
        
        userData.inventory.forEach(item => {
            const option = document.createElement('option');
            option.value = item.id;
            option.textContent = item.name;
            option.dataset.price = item.price;
            select.appendChild(option);
        });
        
        if (currentValue) {
            select.value = currentValue;
        }
    });
}

function showInvoiceForm() {
    document.getElementById('invoiceFormContainer').style.display = 'block';
    document.getElementById('invoiceForm').reset();
    document.getElementById('invoiceDate').value = new Date().toISOString().split('T')[0];
    document.getElementById('invoiceNumber').value = `INV-${Date.now().toString().slice(-6)}`;
    
    const itemsTable = document.getElementById('invoiceItemsTable').querySelector('tbody');
    itemsTable.innerHTML = `
        <tr>
            <td>
                <select class="form-select invoice-item" required>
                    <option value="">Select Item</option>
                </select>
            </td>
            <td><input type="text" class="form-control invoice-description"></td>
            <td><input type="number" class="form-control invoice-quantity" min="1" value="1" required></td>
            <td><input type="number" class="form-control invoice-price" step="0.01" required></td>
            <td>
                <select class="form-select invoice-gst">
                    <option value="0">0%</option>
                    <option value="5">5%</option>
                    <option value="12">12%</option>
                    <option value="18">18%</option>
                    <option value="28">28%</option>
                </select>
            </td>
            <td class="invoice-total">₹0.00</td>
            <td><button type="button" class="btn btn-danger btn-sm remove-item"><i class="fas fa-trash"></i></button></td>
        </tr>
    `;
    
    loadItemsForInvoice();
    
    document.querySelector('.remove-item').addEventListener('click', function() {
        if (document.querySelectorAll('#invoiceItemsTable tbody tr').length > 1) {
            this.closest('tr').remove();
            calculateInvoiceTotals();
        } else {
            showAlert('Invoice must have at least one item', 'warning');
        }
    });
  
    document.getElementById('invoiceFormContainer').scrollIntoView();
}

function addInvoiceItemRow() {
    const itemsTable = document.getElementById('invoiceItemsTable').querySelector('tbody');
    const newRow = document.createElement('tr');
    newRow.innerHTML = `
        <td>
            <select class="form-select invoice-item" required>
                <option value="">Select Item</option>
            </select>
        </td>
        <td><input type="text" class="form-control invoice-description"></td>
        <td><input type="number" class="form-control invoice-quantity" min="1" value="1" required></td>
        <td><input type="number" class="form-control invoice-price" step="0.01" required></td>
        <td>
            <select class="form-select invoice-gst">
                <option value="0">0%</option>
                <option value="5">5%</option>
                <option value="12">12%</option>
                <option value="18">18%</option>
                <option value="28">28%</option>
            </select>
        </td>
        <td class="invoice-total">₹0.00</td>
        <td><button type="button" class="btn btn-danger btn-sm remove-item"><i class="fas fa-trash"></i></button></td>
    `;
    itemsTable.appendChild(newRow);
    
    loadItemsForInvoice();
    
    newRow.querySelector('.remove-item').addEventListener('click', function() {
        if (document.querySelectorAll('#invoiceItemsTable tbody tr').length > 1) {
            this.closest('tr').remove();
            calculateInvoiceTotals();
        } else {
            showAlert('Invoice must have at least one item', 'warning');
        }
    });
    
    newRow.querySelector('.invoice-item').addEventListener('change', function() {
        const selectedOption = this.options[this.selectedIndex];
        if (selectedOption && selectedOption.dataset.price) {
            const priceInput = this.closest('tr').querySelector('.invoice-price');
            priceInput.value = parseFloat(selectedOption.dataset.price).toFixed(2);
            calculateInvoiceItemTotal(this.closest('tr'));
        }
    });
}

function calculateInvoiceItemTotal(row) {
    const quantity = parseFloat(row.querySelector('.invoice-quantity').value) || 0;
    const price = parseFloat(row.querySelector('.invoice-price').value) || 0;
    const gst = parseFloat(row.querySelector('.invoice-gst').value) || 0;
    
    const subtotal = quantity * price;
    const gstAmount = subtotal * (gst / 100);
    const total = subtotal + gstAmount;
    
    row.querySelector('.invoice-total').textContent = formatCurrency(total);
    calculateInvoiceTotals();
}

function calculateInvoiceTotals() {
    let subtotal = 0;
    let totalGst = 0;
    let total = 0;
    
    document.querySelectorAll('#invoiceItemsTable tbody tr').forEach(row => {
        const quantity = parseFloat(row.querySelector('.invoice-quantity').value) || 0;
        const price = parseFloat(row.querySelector('.invoice-price').value) || 0;
        const gst = parseFloat(row.querySelector('.invoice-gst').value) || 0;
        
        const rowSubtotal = quantity * price;
        const rowGst = rowSubtotal * (gst / 100);
        
        subtotal += rowSubtotal;
        totalGst += rowGst;
        total += rowSubtotal + rowGst;
    });
    
    document.getElementById('invoiceSubtotal').textContent = formatCurrency(subtotal);
    document.getElementById('invoiceGst').textContent = formatCurrency(totalGst);
    document.getElementById('invoiceTotal').textContent = formatCurrency(total);
    
    const amountPaid = parseFloat(document.getElementById('amountPaid').value) || 0;
    document.getElementById('invoiceDue').textContent = formatCurrency(total - amountPaid);
}

function saveInvoice(e) {
    e.preventDefault();
    
    const userData = getUserData();
    if (!userData) return;
    
    const customerId = document.getElementById('invoiceCustomer').value;
    const customer = userData.customers.find(c => c.id === customerId);
    if (!customer) {
        showAlert('Please select a customer', 'danger');
        return;
    }
    
    const items = [];
    document.querySelectorAll('#invoiceItemsTable tbody tr').forEach(row => {
        const itemSelect = row.querySelector('.invoice-item');
        const selectedOption = itemSelect.options[itemSelect.selectedIndex];
        
        if (!selectedOption || !selectedOption.value) {
            showAlert('Please select an item for all rows', 'danger');
            throw new Error('Missing item selection');
        }
        
        items.push({
            item_id: selectedOption.value,
            item_name: selectedOption.text,
            description: row.querySelector('.invoice-description').value || '',
            quantity: parseFloat(row.querySelector('.invoice-quantity').value),
            price: parseFloat(row.querySelector('.invoice-price').value),
            gst_rate: parseFloat(row.querySelector('.invoice-gst').value),
            total: parseFloat(row.querySelector('.invoice-total').textContent.replace(/[^0-9.]/g, ''))
        });
    });
    
    const subtotal = parseFloat(document.getElementById('invoiceSubtotal').textContent.replace(/[^0-9.]/g, ''));
    const gst = parseFloat(document.getElementById('invoiceGst').textContent.replace(/[^0-9.]/g, ''));
    const total = parseFloat(document.getElementById('invoiceTotal').textContent.replace(/[^0-9.]/g, ''));
    const amountPaid = parseFloat(document.getElementById('amountPaid').value) || 0;
    
    const invoice = {
        id: Date.now().toString(),
        invoice_number: document.getElementById('invoiceNumber').value,
        date: document.getElementById('invoiceDate').value,
        customer_id: customerId,
        customer_name: customer.name,
        items: items,
        subtotal: subtotal,
        gst_amount: gst,
        total_amount: total,
        amount_paid: amountPaid,
        payment_method: document.getElementById('paymentMethod').value,
        notes: document.getElementById('invoiceNotes').value || '',
        status: amountPaid >= total ? 'paid' : (amountPaid > 0 ? 'partial' : 'unpaid'),
        created_at: new Date().toISOString()
    };
    
    userData.invoices.push(invoice);
    
    if (document.getElementById('paymentMethod').value === 'credit') {
        const customerIndex = userData.customers.findIndex(c => c.id === customerId);
        if (customerIndex !== -1) {
            const currentBalance = parseFloat(userData.customers[customerIndex].balance || 0);
            userData.customers[customerIndex].balance = (currentBalance + (total - amountPaid)).toFixed(2);
        }
    }
    
    items.forEach(item => {
        const inventoryItem = userData.inventory.find(i => i.id === item.item_id);
        if (inventoryItem) {
            inventoryItem.current_stock = parseInt(inventoryItem.current_stock) - item.quantity;
        }
    });
    
    saveUserData(userData);
    
    showAlert('Invoice saved successfully!', 'success');
    loadInvoices();
    loadDashboardData();
    
    document.getElementById('invoiceFormContainer').style.display = 'none';
}

function viewInvoice(id) {
    const userData = getUserData();
    if (!userData) return;
    
    const invoice = userData.invoices.find(i => i.id === id);
    if (!invoice) return;
    
    let itemsHtml = '';
    invoice.items.forEach(item => {
        itemsHtml += `
            <tr>
                <td>${item.item_name}</td>
                <td>${item.description || '-'}</td>
                <td>${item.quantity}</td>
                <td>${formatCurrency(item.price)}</td>
                <td>${item.gst_rate}%</td>
                <td>${formatCurrency(item.total)}</td>
            </tr>
        `;
    });
    
    const printContent = `
        <div class="invoice-header">
            <div class="row">
                <div class="col-md-6">
                    <h3>${userData.user.business_name || 'Business Name'}</h3>
                    <p>${userData.user.address || 'Business Address'}</p>
                    <p>GSTIN: ${userData.user.gstin || 'Not Provided'}</p>
                </div>
                <div class="col-md-6 text-end">
                    <h3>INVOICE</h3>
                    <p><strong>Invoice #:</strong> ${invoice.invoice_number}</p>
                    <p><strong>Date:</strong> ${formatDate(invoice.date)}</p>
                </div>
            </div>
        </div>
        
        <div class="row mb-4">
            <div class="col-md-6">
                <h5>Bill To:</h5>
                <p>${invoice.customer_name}</p>
            </div>
            <div class="col-md-6 text-end">
                <p><strong>Status:</strong> ${invoice.status.toUpperCase()}</p>
                <p><strong>Payment Method:</strong> ${invoice.payment_method.toUpperCase()}</p>
            </div>
        </div>
        
        <div class="invoice-items">
            <table class="table table-bordered">
                <thead>
                    <tr>
                        <th>Item</th>
                        <th>Description</th>
                        <th>Qty</th>
                        <th>Price</th>
                        <th>GST %</th>
                        <th>Total</th>
                    </tr>
                </thead>
                <tbody>
                    ${itemsHtml}
                </tbody>
            </table>
        </div>
        
        <div class="row">
            <div class="col-md-6">
                <p><strong>Notes:</strong> ${invoice.notes || 'N/A'}</p>
            </div>
            <div class="col-md-6">
                <div class="table-responsive">
                    <table class="table">
                        <tr>
                            <td><strong>Subtotal:</strong></td>
                            <td>${formatCurrency(invoice.subtotal)}</td>
                        </tr>
                        <tr>
                            <td><strong>GST:</strong></td>
                            <td>${formatCurrency(invoice.gst_amount)}</td>
                        </tr>
                        <tr class="fw-bold">
                            <td><strong>Total:</strong></td>
                            <td>${formatCurrency(invoice.total_amount)}</td>
                        </tr>
                        <tr>
                            <td><strong>Amount Paid:</strong></td>
                            <td>${formatCurrency(invoice.amount_paid)}</td>
                        </tr>
                        <tr class="fw-bold">
                            <td><strong>Balance Due:</strong></td>
                            <td>${formatCurrency(invoice.total_amount - invoice.amount_paid)}</td>
                        </tr>
                    </table>
                </div>
            </div>
        </div>
        
        <div class="mt-5 pt-4 border-top text-center">
            <p>Thank you for your business!</p>
        </div>
    `;
    
    document.getElementById('invoicePrintContent').innerHTML = printContent;
    const modal = new bootstrap.Modal(document.getElementById('invoicePrintModal'));
    modal.show();
}

function printInvoiceModal() {
    const printContent = document.getElementById('invoicePrintContent').innerHTML;
    const originalContent = document.body.innerHTML;
    
    document.body.innerHTML = printContent;
    window.print();
    document.body.innerHTML = originalContent;
    
    checkLoginStatus();
}

function editInvoice(id) {
    showAlert('Edit invoice functionality would be implemented here', 'info');
}

function generateSalesReport() {
    const userData = getUserData();
    if (!userData) return;
    
    const fromDate = document.getElementById('salesReportFromDate').value;
    const toDate = document.getElementById('salesReportToDate').value;
    
    const filteredInvoices = userData.invoices.filter(invoice => {
        const invoiceDate = new Date(invoice.date);
        const from = new Date(fromDate);
        const to = new Date(toDate);
        return invoiceDate >= from && invoiceDate <= to;
    });
    
    const salesTable = document.getElementById('salesReportTable').querySelector('tbody');
    salesTable.innerHTML = '';
    
    let totalSales = 0;
    let totalGst = 0;
    let grandTotal = 0;
    
    filteredInvoices.forEach(invoice => {
        totalSales += parseFloat(invoice.subtotal);
        totalGst += parseFloat(invoice.gst_amount);
        grandTotal += parseFloat(invoice.total_amount);
        
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${formatDate(invoice.date)}</td>
            <td>${invoice.invoice_number}</td>
            <td>${invoice.customer_name}</td>
            <td>${formatCurrency(invoice.subtotal)}</td>
            <td>${formatCurrency(invoice.gst_amount)}</td>
            <td>${formatCurrency(invoice.total_amount)}</td>
        `;
        salesTable.appendChild(row);
    });
    
    const totalsRow = document.createElement('tr');
    totalsRow.className = 'fw-bold';
    totalsRow.innerHTML = `
        <td colspan="3">Total</td>
        <td>${formatCurrency(totalSales)}</td>
        <td>${formatCurrency(totalGst)}</td>
        <td>${formatCurrency(grandTotal)}</td>
    `;
    salesTable.appendChild(totalsRow);
    
    updateSalesChart(filteredInvoices);
}

function updateSalesChart(invoices) {
    const salesByDate = {};
    invoices.forEach(invoice => {
        if (!salesByDate[invoice.date]) {
            salesByDate[invoice.date] = 0;
        }
        salesByDate[invoice.date] += parseFloat(invoice.total_amount);
    });
    
    const dates = Object.keys(salesByDate).sort();
    const amounts = dates.map(date => salesByDate[date]);
    
    const ctx = document.getElementById('salesChart').getContext('2d');
    
    if (window.salesChart) {
        window.salesChart.destroy();
    }
    
    window.salesChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: dates,
            datasets: [{
                label: 'Sales Amount (₹)',
                data: amounts,
                backgroundColor: 'rgba(54, 162, 235, 0.5)',
                borderColor: 'rgba(54, 162, 235, 1)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });
}

function generateExpenseReport() {
    const userData = getUserData();
    if (!userData) return;
    
    const fromDate = document.getElementById('expenseReportFromDate').value;
    const toDate = document.getElementById('expenseReportToDate').value;
    
    const filteredExpenses = userData.transactions.filter(t => {
        if (t.type !== 'expense') return false;
        
        const tDate = new Date(t.date);
        const from = new Date(fromDate);
        const to = new Date(toDate);
        return tDate >= from && tDate <= to;
    });
    
    const expenseTable = document.getElementById('expenseReportTable').querySelector('tbody');
    expenseTable.innerHTML = '';
    
    let totalExpenses = 0;
    
    filteredExpenses.forEach(expense => {
        totalExpenses += parseFloat(expense.amount);
        
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${formatDate(expense.date)}</td>
            <td>${expense.description || '-'}</td>
            <td>${expense.category || '-'}</td>
            <td>${formatCurrency(expense.amount)}</td>
            <td>${expense.payment_method || '-'}</td>
        `;
        expenseTable.appendChild(row);
    });
    
    const totalsRow = document.createElement('tr');
    totalsRow.className = 'fw-bold';
    totalsRow.innerHTML = `
        <td colspan="3">Total</td>
        <td>${formatCurrency(totalExpenses)}</td>
        <td></td>
    `;
    expenseTable.appendChild(totalsRow);
    
    updateExpensesChart(filteredExpenses);
}

function updateExpensesChart(expenses) {
    const expensesByCategory = {};
    expenses.forEach(expense => {
        const category = expense.category || 'Uncategorized';
        if (!expensesByCategory[category]) {
            expensesByCategory[category] = 0;
        }
        expensesByCategory[category] += parseFloat(expense.amount);
    });
    
    const categories = Object.keys(expensesByCategory);
    const amounts = categories.map(cat => expensesByCategory[cat]);
    
    const ctx = document.getElementById('expensesChart').getContext('2d');
    
    if (window.expensesChart) {
        window.expensesChart.destroy();
    }
    
    window.expensesChart = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: categories,
            datasets: [{
                data: amounts,
                backgroundColor: [
                    'rgba(255, 99, 132, 0.5)',
                    'rgba(54, 162, 235, 0.5)',
                    'rgba(255, 206, 86, 0.5)',
                    'rgba(75, 192, 192, 0.5)',
                    'rgba(153, 102, 255, 0.5)',
                    'rgba(255, 159, 64, 0.5)'
                ],
                borderColor: [
                    'rgba(255, 99, 132, 1)',
                    'rgba(54, 162, 235, 1)',
                    'rgba(255, 206, 86, 1)',
                    'rgba(75, 192, 192, 1)',
                    'rgba(153, 102, 255, 1)',
                    'rgba(255, 159, 64, 1)'
                ],
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    position: 'right',
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const label = context.label || '';
                            const value = context.raw || 0;
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const percentage = Math.round((value / total) * 100);
                            return `${label}: ${formatCurrency(value)} (${percentage}%)`;
                        }
                    }
                }
            }
        }
    });
}

function generateProfitLossReport() {
    const userData = getUserData();
    if (!userData) return;
    
    const fromDate = document.getElementById('plReportFromDate').value;
    const toDate = document.getElementById('plReportToDate').value;
    
    let totalIncome = 0;
    userData.invoices.forEach(invoice => {
        const invoiceDate = new Date(invoice.date);
        const from = new Date(fromDate);
        const to = new Date(toDate);
        
        if (invoiceDate >= from && invoiceDate <= to) {
            totalIncome += parseFloat(invoice.total_amount);
        }
    });
    
    userData.transactions.forEach(t => {
        if (t.type !== 'income') return;
        
        const tDate = new Date(t.date);
        const from = new Date(fromDate);
        const to = new Date(toDate);
        
        if (tDate >= from && tDate <= to) {
            totalIncome += parseFloat(t.amount);
        }
    });
    
    let totalExpenses = 0;
    userData.transactions.forEach(t => {
        if (t.type !== 'expense') return;
        
        const tDate = new Date(t.date);
        const from = new Date(fromDate);
        const to = new Date(toDate);
        
        if (tDate >= from && tDate <= to) {
            totalExpenses += parseFloat(t.amount);
        }
    });
    
    document.getElementById('plIncome').textContent = formatCurrency(totalIncome);
    document.getElementById('plExpenses').textContent = formatCurrency(totalExpenses);
    document.getElementById('plNet').textContent = formatCurrency(totalIncome - totalExpenses);
    
    updateProfitLossChart(totalIncome, totalExpenses);
}

function updateProfitLossChart(income, expenses) {
    const ctx = document.getElementById('profitLossChart').getContext('2d');
    
    if (window.profitLossChart) {
        window.profitLossChart.destroy();
    }
    
    window.profitLossChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Income', 'Expenses', 'Profit/Loss'],
            datasets: [{
                label: 'Amount (₹)',
                data: [income, expenses, income - expenses],
                backgroundColor: [
                    'rgba(75, 192, 192, 0.5)',
                    'rgba(255, 99, 132, 0.5)',
                    income - expenses >= 0 ? 'rgba(54, 162, 235, 0.5)' : 'rgba(255, 159, 64, 0.5)'
                ],
                borderColor: [
                    'rgba(75, 192, 192, 1)',
                    'rgba(255, 99, 132, 1)',
                    income - expenses >= 0 ? 'rgba(54, 162, 235, 1)' : 'rgba(255, 159, 64, 1)'
                ],
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });
}

function generateInventoryReport() {
    const userData = getUserData();
    if (!userData) return;
    
    const reportType = document.getElementById('inventoryReportType').value;
    
    let filteredItems = [...userData.inventory];
    
    if (reportType === 'low') {
        filteredItems = filteredItems.filter(item => 
            item.alert_level && parseInt(item.current_stock) <= parseInt(item.alert_level)
        );
    } else if (reportType === 'out') {
        filteredItems = filteredItems.filter(item => 
            parseInt(item.current_stock) <= 0
        );
    } else if (reportType === 'sales') {
        filteredItems.sort((a, b) => a.name.localeCompare(b.name));
    }
    
    const inventoryTable = document.getElementById('inventoryReportTable').querySelector('tbody');
    inventoryTable.innerHTML = '';
    
    let totalValue = 0;
    
    filteredItems.forEach(item => {
        const value = parseFloat(item.price) * parseInt(item.current_stock);
        totalValue += value;
        
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${item.name}</td>
            <td>${item.sku || '-'}</td>
            <td>${item.current_stock}</td>
            <td>${formatCurrency(item.price)}</td>
            <td>${formatCurrency(value)}</td>
            <td>0</td> <!-- Sold count would come from sales data in a real app -->
        `;
        inventoryTable.appendChild(row);
    });
    
    const totalsRow = document.createElement('tr');
    totalsRow.className = 'fw-bold';
    totalsRow.innerHTML = `
        <td colspan="4">Total</td>
        <td>${formatCurrency(totalValue)}</td>
        <td></td>
    `;
    inventoryTable.appendChild(totalsRow);
}

function loadProfile() {
    const userData = getUserData();
    if (!userData || !userData.user) return;
    
    const user = userData.user;
    document.getElementById('profileOwnerName').value = user.owner_name;
    document.getElementById('profileBusinessName').value = user.business_name;
    document.getElementById('profileContactNumber').value = user.contact_number;
    document.getElementById('profileEmail').value = user.email || '';
    document.getElementById('profileGstin').value = user.gstin || '';
    document.getElementById('profileAddress').value = user.address || '';
}

function updateProfile(e) {
    e.preventDefault();
    
    const userData = getUserData();
    if (!userData) return;
    
    userData.user.owner_name = document.getElementById('profileOwnerName').value;
    userData.user.business_name = document.getElementById('profileBusinessName').value;
    userData.user.contact_number = document.getElementById('profileContactNumber').value;
    userData.user.email = document.getElementById('profileEmail').value || '';
    userData.user.gstin = document.getElementById('profileGstin').value || '';
    userData.user.address = document.getElementById('profileAddress').value || '';
    
    saveUserData(userData);
    
    updateSheetDBUser(userData.user);
    
    showAlert('Profile updated successfully!', 'success');
}

async function updateSheetDBUser(user) {
    try {
        await axios.patch(SHEETDB_API_URL, {
            data: [{
                username: user.username,
                owner_name: user.owner_name,
                business_name: user.business_name,
                contact_number: user.contact_number,
                email: user.email,
                gstin: user.gstin,
                address: user.address
            }]
        });
    } catch (error) {
        console.error('Error updating user in SheetDB:', error);
    }
}

function changePassword(e) {
    e.preventDefault();
    
    const currentPassword = document.getElementById('currentPassword').value;
    const newPassword = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    
    if (newPassword !== confirmPassword) {
        showAlert('New passwords do not match', 'danger');
        return;
    }
    
    const userData = getUserData();
    if (!userData) return;
    
    if (userData.user.password !== currentPassword) {
        showAlert('Current password is incorrect', 'danger');
        return;
    }
    
    userData.user.password = newPassword;
    
    saveUserData(userData);
    
    updateSheetDBPassword(userData.user.username, newPassword);
    
    document.getElementById('passwordForm').reset();
    showAlert('Password changed successfully!', 'success');
}

async function updateSheetDBPassword(username, newPassword) {
    try {
        await axios.patch(SHEETDB_API_URL, {
            data: [{
                username: username,
                password: newPassword
            }]
        });
    } catch (error) {
        console.error('Error updating password in SheetDB:', error);
    }
}

function showSubscriptionModal(plan) {
    const planNames = {
        monthly: 'Monthly (₹300)',
        yearly: 'Yearly (₹2500)',
        lifetime: 'Lifetime (₹8000)'
    };
    
    document.getElementById('confirmModalBody').innerHTML = `
        <p>You are about to subscribe to the <strong>${planNames[plan]}</strong> plan.</p>
        <p>Please make payment to our UPI ID: <strong>lumineerco@ibl</strong> and send the transaction details to <strong>lumineerc@gmail.com</strong> with your username.</p>
        <p>Your subscription will be activated within 24 hours of payment confirmation.</p>
    `;
    
    document.getElementById('confirmActionBtn').dataset.action = 'subscribe';
    document.getElementById('confirmActionBtn').dataset.plan = plan;
    
    const modal = new bootstrap.Modal(document.getElementById('confirmModal'));
    modal.show();
}

function confirmDelete(type, id, subType = null) {
    const typeNames = {
        transaction: 'transaction',
        inventory: 'inventory item',
        contact: subType === 'customer' ? 'customer' : 'supplier',
        invoice: 'invoice'
    };
    
    document.getElementById('confirmModalBody').textContent = `Are you sure you want to delete this ${typeNames[type]}? This action cannot be undone.`;
    document.getElementById('confirmActionBtn').dataset.action = 'delete';
    document.getElementById('confirmActionBtn').dataset.type = type;
    document.getElementById('confirmActionBtn').dataset.id = id;
    if (subType) {
        document.getElementById('confirmActionBtn').dataset.subType = subType;
    }
    
    const modal = new bootstrap.Modal(document.getElementById('confirmModal'));
    modal.show();
}

function confirmAction() {
    const action = this.dataset.action;
    
    if (action === 'delete') {
        const type = this.dataset.type;
        const id = this.dataset.id;
        const subType = this.dataset.subType;
        
        deleteItem(type, id, subType);
    } else if (action === 'subscribe') {
        const plan = this.dataset.plan;
        showAlert(`Subscription request received for ${plan} plan. Please complete the payment as instructed.`, 'info');
    }
    
    const modal = bootstrap.Modal.getInstance(document.getElementById('confirmModal'));
    modal.hide();
}

function deleteItem(type, id, subType = null) {
    const userData = getUserData();
    if (!userData) return;
    
    let collection;
    switch(type) {
        case 'transaction':
            collection = 'transactions';
            break;
        case 'inventory':
            collection = 'inventory';
            break;
        case 'contact':
            collection = subType === 'customer' ? 'customers' : 'suppliers';
            break;
        case 'invoice':
            collection = 'invoices';
            break;
        default:
            return;
    }
    
    const index = userData[collection].findIndex(item => item.id === id);
    if (index !== -1) {
        userData[collection].splice(index, 1);
        saveUserData(userData);
        
        showAlert(`${type.charAt(0).toUpperCase() + type.slice(1)} deleted successfully`, 'success');
        
        switch(type) {
            case 'transaction':
                loadTransactions();
                break;
            case 'inventory':
                loadInventory();
                break;
            case 'contact':
                loadContacts();
                break;
            case 'invoice':
                loadInvoices();
                break;
        }
        
        loadDashboardData();
    }
}

function printInvoice() {
    showAlert('Print functionality would be implemented here', 'info');
}
