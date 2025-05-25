// Product management logic for manager dashboard

let products = JSON.parse(localStorage.getItem('managerProducts')) || [];
let editingProductId = null;

// Utility: Render products grid
function renderProducts(filter = '', sort = '') {
    const grid = document.getElementById('manager-products-grid');
    // Remove all except the add-product card
    grid.querySelectorAll('.compare-product:not(.add-product)').forEach(e => e.remove());

    let filtered = products.filter(p => {
        // Support filter for multiple categories
        const categories = Array.isArray(p.category) ? p.category : (typeof p.category === 'string' ? p.category.split(',').map(c => c.trim()) : []);
        return (
            p.name.toLowerCase().includes(filter.toLowerCase()) ||
            categories.some(cat => cat.toLowerCase().includes(filter.toLowerCase()))
        );
    });

    if (sort === 'name') filtered.sort((a, b) => a.name.localeCompare(b.name));
    if (sort === 'priceLow') filtered.sort((a, b) => getLowestPrice(a) - getLowestPrice(b));
    if (sort === 'priceHigh') filtered.sort((a, b) => getLowestPrice(b) - getLowestPrice(a));

    filtered.forEach((prod, idx) => {
        const card = document.createElement('div');
        card.className = 'compare-product';
        const lowestPrice = getLowestPrice(prod);
        // Show all categories as comma separated
        let cats = Array.isArray(prod.category) ? prod.category.join(', ') : prod.category;
        card.innerHTML = `
            <img src="${prod.images && prod.images[0] ? prod.images[0] : './images/COMPAREIT Logo - Black with Transparent Background.svg'}" alt="${prod.name}">
            <div class="compare-desc">
                <h5>${prod.name}</h5>
                <h4>${lowestPrice !== null ? '$' + lowestPrice : ''}</h4>
                <p style="font-size:13px; color:#888;">${cats}</p>
            </div>
            <div class="manager-action-btns">
                <button class="edit-btn" data-id="${prod.id}"><i class="fa fa-pen"></i> Edit</button>
                <button class="delete-btn" data-id="${prod.id}"><i class="fa fa-trash"></i> Delete</button>
            </div>
        `;
        grid.insertBefore(card, document.getElementById('addProductBtn'));
    });
}

// Helper: Get lowest price from retailers or price
function getLowestPrice(prod) {
    if (prod.retailers && prod.retailers.length) {
        let prices = prod.retailers.map(r => parseFloat(r.price)).filter(p => !isNaN(p));
        if (prices.length) return Math.min(...prices);
    }
    return typeof prod.price === 'number' ? prod.price : null;
}

// Retailers UI logic
function addRetailerField(retailer = {name: '', price: ''}) {
    const div = document.createElement('div');
    div.className = 'retailer-row';
    div.style.display = 'flex';
    div.style.gap = '8px';
    div.style.marginBottom = '6px';
    div.innerHTML = `
        <input type="text" class="retailer-name" placeholder="Retailer name" value="${retailer.name || ''}" style="flex:2; padding:6px; border-radius:5px; border:1px solid #ddd;">
        <input type="number" class="retailer-price" placeholder="Price" min="0" step="0.01" value="${retailer.price || ''}" style="flex:1; padding:6px; border-radius:5px; border:1px solid #ddd;">
        <button type="button" class="remove-retailer-btn" style="background:#d9534f; color:#fff; border:none; border-radius:5px; padding:0 10px; font-size:18px; cursor:pointer;">&times;</button>
    `;
    div.querySelector('.remove-retailer-btn').onclick = () => div.remove();
    document.getElementById('retailersList').appendChild(div);
}

document.getElementById('addRetailerBtn').onclick = function() {
    addRetailerField();
};

// Utility: Show modal
function showProductModal(edit = false, product = null) {
    const modal = document.getElementById('productModal');
    modal.classList.add('show');
    document.getElementById('modalTitle').textContent = edit ? 'Edit Product' : 'Add Product';
    document.getElementById('modalError').textContent = '';
    document.getElementById('productForm').reset();
    document.getElementById('imagePreview').innerHTML = '';
    document.getElementById('editProductId').value = '';
    document.getElementById('retailersList').innerHTML = '';

    if (edit && product) {
        document.getElementById('prodName').value = product.name;
        document.getElementById('prodPrice').value = product.price;
        // Join categories for input
        document.getElementById('prodCategory').value = Array.isArray(product.category) ? product.category.join(', ') : product.category;
        document.getElementById('prodDesc').value = product.description;
        document.getElementById('editProductId').value = product.id;
        // Show images
        if (product.images && product.images.length) {
            product.images.forEach(src => {
                const img = document.createElement('img');
                img.src = src;
                document.getElementById('imagePreview').appendChild(img);
            });
        }
        // Show retailers
        if (product.retailers && product.retailers.length) {
            product.retailers.forEach(r => addRetailerField(r));
        }
    }
}

// Utility: Hide modal
function hideProductModal() {
    document.getElementById('productModal').classList.remove('show');
}

// Handle Add Product button
document.getElementById('addProductBtn').onclick = () => {
    editingProductId = null;
    showProductModal(false);
};

// Handle close modal
document.getElementById('closeModal').onclick = hideProductModal;

// Handle form submit (add/edit)
document.getElementById('productForm').onsubmit = function(e) {
    e.preventDefault();
    const name = document.getElementById('prodName').value.trim();
    const price = parseFloat(document.getElementById('prodPrice').value);
    // Parse categories as array
    const category = document.getElementById('prodCategory').value.split(',').map(c => c.trim()).filter(Boolean);
    const description = document.getElementById('prodDesc').value.trim();
    const editId = document.getElementById('editProductId').value;
    let images = [];
    document.querySelectorAll('#imagePreview img').forEach(img => images.push(img.src));

    // Gather retailers
    let retailers = [];
    document.querySelectorAll('#retailersList .retailer-row').forEach(row => {
        const rName = row.querySelector('.retailer-name').value.trim();
        const rPrice = row.querySelector('.retailer-price').value.trim();
        if (rName && rPrice) {
            retailers.push({ name: rName, price: parseFloat(rPrice) });
        }
    });

    if (!name || !category.length || !description || isNaN(price)) {
        document.getElementById('modalError').textContent = 'Please fill all fields.';
        return;
    }

    if (editId) {
        // Edit
        const idx = products.findIndex(p => p.id === editId);
        if (idx !== -1) {
            products[idx] = { ...products[idx], name, price, category, description, images, retailers };
        }
    } else {
        // Add
        products.push({
            id: 'prod_' + Date.now(),
            name, price, category, description, images, retailers
        });
    }
    localStorage.setItem('managerProducts', JSON.stringify(products));
    renderProducts();
    hideProductModal();
};

// Handle image preview
document.getElementById('prodImages').onchange = function(e) {
    const files = Array.from(e.target.files);
    const preview = document.getElementById('imagePreview');
    preview.innerHTML = '';
    files.forEach(file => {
        const reader = new FileReader();
        reader.onload = function(ev) {
            const img = document.createElement('img');
            img.src = ev.target.result;
            preview.appendChild(img);
        };
        reader.readAsDataURL(file);
    });
};

// Handle edit/delete buttons
document.getElementById('manager-products-grid').onclick = function(e) {
    if (e.target.closest('.edit-btn')) {
        const id = e.target.closest('.edit-btn').dataset.id;
        const prod = products.find(p => p.id === id);
        if (prod) {
            editingProductId = id;
            showProductModal(true, prod);
        }
    }
    if (e.target.closest('.delete-btn')) {
        const id = e.target.closest('.delete-btn').dataset.id;
        if (confirm('Delete this product?')) {
            products = products.filter(p => p.id !== id);
            localStorage.setItem('managerProducts', JSON.stringify(products));
            renderProducts();
        }
    }
};

// Search functionality
document.getElementById('productSearchBtn').onclick = function() {
    const val = document.getElementById('productSearchInput').value;
    renderProducts(val, document.getElementById('sortProducts').value);
};
document.getElementById('productSearchInput').oninput = function() {
    renderProducts(this.value, document.getElementById('sortProducts').value);
};

// Sort functionality
document.getElementById('sortProducts').onchange = function() {
    renderProducts(document.getElementById('productSearchInput').value, this.value);
};

// Initial render
renderProducts();
