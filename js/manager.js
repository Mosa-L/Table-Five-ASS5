const API_URL = './api.php';
const apiKey = localStorage.getItem('apikey');
const userType = localStorage.getItem('user_type');
let products = [];
let editingProductId = null;

// Redirect to login if not manager
if (!apiKey || userType !== 'Manager') {
    alert('You must be logged in as a manager to access this page.');
    window.location.href = 'login.html';
}

// Fetch and render products from API
function fetchAndRenderProducts(options = {}) {
    const payload = {
        type: 'GetAllProducts',
        apikey: apiKey,
        return: '*',
        search: {},
        fuzzy: true
    };

    // Search
    if (options.search && options.search.text) {
        payload.search.Title = options.search.text;
    }
    // Sort
    if (options.sort) {
        if (options.sort === 'name') payload.sort = 'Title';
        if (options.sort === 'priceLow' || options.sort === 'priceHigh') payload.sort = 'price';
        if (options.sort === 'priceLow') payload.order = 'ASC';
        if (options.sort === 'priceHigh') payload.order = 'DESC';
    }

    // POST to API
    fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    })
    .then(res => res.json())
    .then(data => {
        if (data.status === 'success') {
            products = data.data;
            renderProducts(products);
        } else {
            document.getElementById('manager-products-grid').innerHTML = `<p class="error">${data.data || 'Failed to load products.'}</p>`;
        }
    })
    .catch(err => {
        document.getElementById('manager-products-grid').innerHTML = `<p class="error">Server error loading products.</p>`;
        console.error(err);
    });
}

// Render products grid
function renderProducts(products) {
    const grid = document.getElementById('manager-products-grid');
    // Remove all product cards except the add-product card
    grid.querySelectorAll('.compare-product:not(.add-product)').forEach(e => e.remove());

    // Move the add-product card to the top if it's not already
    const addProductCard = document.getElementById('addProductBtn');
    if (addProductCard && addProductCard.parentNode.firstChild !== addProductCard) {
        grid.insertBefore(addProductCard, grid.firstChild);
    }

    // Insert each product card after the add-product card
    let insertAfter = addProductCard;
    products.forEach(prod => {
        const card = document.createElement('div');
        card.className = 'compare-product';
        const lowestPrice = prod.LowestPrice || (prod.Retailers && prod.Retailers.length ? Math.min(...prod.Retailers.map(r => parseFloat(r.Price))) : null);
        let cats = Array.isArray(prod.Categories) ? prod.Categories.join(', ') : (prod.Categories || '');
        card.innerHTML = `
            <img src="${prod.Image_url || './images/COMPAREIT Logo - Black with Transparent Background.svg'}" alt="${prod.Title}">
            <div class="compare-desc">
                <h5>${prod.Title}</h5>
                <h4>${lowestPrice !== null ? 'R' + lowestPrice : ''}</h4>
                <p style="font-size:13px; color:#888;">${cats}</p>
            </div>
            <div class="manager-action-btns">
                <button class="edit-btn" data-id="${prod.ProductID}"><i class="fa fa-pen"></i> Edit</button>
                <button class="delete-btn" data-id="${prod.ProductID}"><i class="fa fa-trash"></i> Delete</button>
            </div>
        `;
        // Insert after the add product card
        if (insertAfter.nextSibling) {
            grid.insertBefore(card, insertAfter.nextSibling);
        } else {
            grid.appendChild(card);
        }
        insertAfter = card;
    });
}

// Modal logic
function showProductModal(edit = false, product = null) {
    const modal = document.getElementById('productModal');
    modal.classList.add('show');
    document.getElementById('modalTitle').textContent = edit ? 'Edit Product' : 'Add Product';
    document.getElementById('modalError').textContent = '';
    document.getElementById('productForm').reset();
    document.getElementById('editProductId').value = '';
    document.getElementById('retailersList').innerHTML = '';
    document.getElementById('specList').innerHTML = '';

	// Reset retailer and spec fields
    if (edit && product) {
        document.getElementById('prodName').value = product.Title || '';
        document.getElementById('prodBrand').value = product.Brand || '';
        document.getElementById('prodCategory').value = Array.isArray(product.Categories) ? product.Categories.join(', ') : (product.Categories || '');
        document.getElementById('prodDesc').value = product.Description || '';
        document.getElementById('editProductId').value = product.ProductID;
        document.getElementById('prodImage').value = product.Image_url || '';
		if (product.Specifications && typeof product.Specifications === 'object') {
			Object.entries(product.Specifications).forEach(([type, value]) => {
				addSpecField({ type, value });
			});
			// If Specifications is an object, convert it to array format
		} else if (product.Specs && Array.isArray(product.Specs)) {
			product.Specs.forEach(s => {
				addSpecField({
					type: s.type || s.Type || '',
					value: s.value || s.Value || ''
				});
			});
		}
        // Populate retailers if present
        if (product.Retailers && Array.isArray(product.Retailers)) {
            product.Retailers.forEach(r => {
                addRetailerField({
                    name: r.Name || r.name || '',
                    price: r.Price || r.price || '',
                    stock: r.Stock || r.stock || ''
                });
            });
        }
    }
}
// add retailers input rows
function addRetailerField(retailer = {name: '', price: '', stock: ''}) {
    const div = document.createElement('div');
    div.className = 'retailer-row';
    div.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 6px; align-items: flex-start;">
            <div style="display: flex; gap: 8px; align-items: center;">
                <input type="text" class="retailer-name" placeholder="Retailer name" value="${retailer.name || ''}">
                <input type="number" class="retailer-price" placeholder="Price" min="0" step="0.01" value="${retailer.price || ''}">
                <button type="button" class="remove-retailer-btn">&times;</button>
            </div>
            <div style="display: flex; flex-direction: column; max-width: 200px;">
                <label style="font-size: 13px; color: #555; margin-bottom: 2px;">Stock</label>
                <input type="number" class="retailer-stock" placeholder="Stock" min="0" step="1" value="${retailer.stock || ''}">
            </div>
        </div>
    `;
    div.querySelector('.remove-retailer-btn').onclick = () => div.remove();
    document.getElementById('retailersList').appendChild(div);
}


document.getElementById('addRetailerBtn').onclick = function() {
    addRetailerField();
};

// Add spec input row
function addSpecField(spec = {type: '', value: ''}) {
    const div = document.createElement('div');
    div.className = 'spec-row';
    div.style.display = 'flex';
    div.style.gap = '8px';
    div.style.marginBottom = '6px';
    div.innerHTML = `
        <input type="text" class="spec-type" placeholder="Specification" value="${spec.type || ''}">
        <input type="text" class="spec-value" placeholder="Value" value="${spec.value || ''}">
        <button type="button" class="remove-spec-btn">&times;</button>
    `;
    div.querySelector('.remove-spec-btn').onclick = () => div.remove();
    document.getElementById('specList').appendChild(div);
}

document.getElementById('addSpecBtn').onclick = function() {
    addSpecField();
};

function hideProductModal() {
    document.getElementById('productModal').classList.remove('show');
}

// Add Product button
document.getElementById('addProductBtn').onclick = () => {
    editingProductId = null;
    showProductModal(false);
};



// Close modal
document.getElementById('closeModal').onclick = hideProductModal;
// Handle form submission
document.getElementById('productForm').onsubmit = function(e) {
    e.preventDefault();
    const title = document.getElementById('prodName').value.trim();
    const brand = document.getElementById('prodBrand').value.trim();
    const category = document.getElementById('prodCategory').value.split(',').map(c => c.trim()).filter(Boolean);
    const description = document.getElementById('prodDesc').value.trim();
    const editId = document.getElementById('editProductId').value;
    const imageUrl = document.getElementById('prodImage').value.trim();

    // Gather specs
    const specs = Array.from(document.querySelectorAll('#specList .spec-row')).map(row => ({
        type: row.querySelector('.spec-type').value.trim(),
        value: row.querySelector('.spec-value').value.trim()
    })).filter(s => s.type && s.value);

    // Gather retailers
    const retailers = Array.from(document.querySelectorAll('#retailersList .retailer-row')).map(row => ({
        RetailerName: row.querySelector('.retailer-name').value.trim(),
        Price: parseFloat(row.querySelector('.retailer-price').value),
        Stock: parseInt(row.querySelector('.retailer-stock').value, 10)
    })).filter(r => r.RetailerName && !isNaN(r.Price) && !isNaN(r.Stock));

    if (!title || !imageUrl || !brand || !category.length || !description) {
        document.getElementById('modalError').textContent = 'Please fill all fields.';
        return;
    }

    if (!retailers.length) {
        document.getElementById('modalError').textContent = 'Please add at least one retailer.';
        return;
    }

    // Prepare payload
    const payload = {
        type: editId ? 'editProduct' : 'addProduct',
        apikey: apiKey,
        Title: title,
        Brand: brand,
        Description: description,
        Image_url: imageUrl,
        ...(editId ? { ProductID: editId } : {}),
        categories: category,
        Specs: specs,
        retailers
    };

    fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    })
    .then(res => res.json())
    .then(data => {
        if (data.status === 'success') {
            hideProductModal();
            fetchAndRenderProducts();
        } else {
            document.getElementById('modalError').textContent = data.data || 'Failed to save product.';
        }
    })
    .catch(err => {
        document.getElementById('modalError').textContent = 'Server error saving product.';
        console.error(err);
    });
};


// Handle edit/delete buttons
document.getElementById('manager-products-grid').onclick = function(e) {
    if (e.target.closest('.edit-btn')) {
        const id = e.target.closest('.edit-btn').dataset.id;
        const prod = products.find(p => p.ProductID == id);
        if (prod) {
            editingProductId = id;
            showProductModal(true, prod);
        }
    }
	// Delete button
    if (e.target.closest('.delete-btn')) {
        const id = e.target.closest('.delete-btn').dataset.id;
        if (confirm('Delete this product?')) {
            fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: 'RemoveProduct',
                    apikey: apiKey,
                    ProductID: id
                })
            })
            .then(res => res.json())
            .then(data => {
                if (data.status === 'success') {
                    fetchAndRenderProducts();
                } else {
                    alert(data.data || 'Failed to delete product.');
                }
            })
            .catch(err => {
                alert('Server error deleting product.');
                console.error(err);
            });
        }
    }
};

// Search and sort event listeners
document.getElementById('searchBut').onclick = function() {
    const text = document.getElementById('searchInput').value.trim();
    fetchAndRenderProducts({
        search: { text: text },
        sort: document.getElementById('category').value
    });
};
// Search input listener
document.getElementById('searchInput').oninput = function() {
    fetchAndRenderProducts({
        search: { text: this.value.trim() },
        sort: document.getElementById('category').value
    });
};
// Category dropdown change listener
document.getElementById('category').onchange = function() {
    fetchAndRenderProducts({
        search: { text: document.getElementById('searchInput').value.trim() },
        sort: this.value
    });
};

// Initial render
fetchAndRenderProducts();
