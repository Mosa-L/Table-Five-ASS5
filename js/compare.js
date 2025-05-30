document.addEventListener('DOMContentLoaded', function() {
    // Get user API key from localStorage (if available)
    const apiKey = localStorage.getItem('apikey') || '3a160d66562032f9'; // Default key for testing

    // Get compare list from localStorage
    let compareList = JSON.parse(localStorage.getItem('compareList')) || [];

	// If compareList contains only IDs, fetch full product info
	if (compareList.length && typeof compareList[0] !== 'object') {
		fetch('api.php', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				type: 'GetAllProducts',
				apikey: apiKey,
				search: { ProductID: compareList[0] }, 
				return: '*'
			})
		})
		.then(response => response.json())
		.then(data => {
			if (data.status === 'success' && data.data.length > 0) {
				compareList = data.data;
				localStorage.setItem('compareList', JSON.stringify(compareList));
				renderCompareGrid();
			} else {
				compareList = [];
				renderCompareGrid();
			}
		})
		.catch(() => {
			compareList = [];
			renderCompareGrid();
		});
	} else {
		renderCompareGrid();
	}
    
    // Initialize container
    const compareContainer = document.querySelector('.compare-container');
    
    // Add event listeners to "Add Product" boxes
    const addBoxes = document.querySelectorAll('.add-product');
    addBoxes.forEach(box => {
        box.addEventListener('click', openProductSearch);
    });
    
    // Function to open product search modal
    function openProductSearch(){
        // Create modal
        const modal = document.createElement('div');
        modal.className = 'search-modal';
        modal.innerHTML = `
            <div class="modal-content">
                <span class="close-modal">&times;</span>
                <h2>Search Products</h2>
                <div class="searchCont">
                    <input type="text" id="productSearch" placeholder="Search products...">
                    <button id="searchButton">Search</button>
                </div>
                <div class="search-results"></div>
            </div>
        `; 
        // Insert modal before the compare grid so it appears above add product boxes
        const compareGrid = document.querySelector('#compare-grid') || document.body;
        compareGrid.parentNode.insertBefore(modal, compareGrid);

        document.body.appendChild(modal);
        
        // Add event listeners
        const closeBtn = modal.querySelector('.close-modal');
        closeBtn.addEventListener('click', () => modal.remove());
        
        const searchBtn = modal.querySelector('#searchButton');
        const searchInput = modal.querySelector('#productSearch');
        const searchResults = modal.querySelector('.search-results');
        
        searchBtn.addEventListener('click', () => {
            const searchTerm = searchInput.value.trim();
            if(!searchTerm)return;
            
            // Show loading indicator
            searchResults.innerHTML = '<p>Searching...</p>';
            
            // Fetch products from API
            fetch('api.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    type: 'GetAllProducts',
                    apikey: apiKey,
                    search: { Title: searchTerm },
                    return: '*'
                })
            })
            .then(response => response.json())
            .then(data => {
                if (data.status === 'success' && data.data.length > 0){
                    displaySearchResults(data.data, searchResults, modal);
                } else {
                    searchResults.innerHTML = '<p>No products found</p>';
                }
            })
            .catch(error => {
                console.error('Error searching products:', error);
                searchResults.innerHTML = '<p>Error searching products</p>';
            });
        });
        
        // Allow search on Enter key
        searchInput.addEventListener('keyup', function(e){
            if(e.key === 'Enter'){
                searchBtn.click();
            }
        });
    }

    function displaySearchResults(products, container, modal){
        container.innerHTML = '';
        products.forEach(product => {
            const productEl = document.createElement('div');
            productEl.className = 'search-result-item';
            productEl.innerHTML = `
                <img src="${product.Image_url || 'images/placeholder.jpg'}" alt="${product.Title}">
                <div class="product-info">
                    <h3>${product.Title}</h3>
                    <p>${product.Brand || ''}</p>
                    <p>R${product.LowestPrice || 'N/A'}</p>
                </div>
            `;
            
            productEl.addEventListener('click', () => {
                addProductToCompare(product);
                modal.remove();
                renderCompareGrid();
            });
            
            container.appendChild(productEl);
        });
    }
    
    // Function to add product to compare list
    function addProductToCompare(product){
        // Check if product already exists in compare list
        const exists = compareList.some(p => p.ProductID === product.ProductID);
        if(exists){
            alert('This product is already in your compare list');
            return;
        }
        
        // If comparing the first product, set as main
        if(compareList.length === 0){
            product.isMain = true;
        }
        
        // Add product to compare list
        compareList.push(product);
        
        // Limit compare list to 4 products
        if(compareList.length > 4){
            compareList.pop();
        }
        
        // Save to localStorage
        localStorage.setItem('compareList', JSON.stringify(compareList));
    }
    
    // Function to render the compare grid
    function renderCompareGrid(){
        const compareContainer = document.querySelector('.compare-container');
        compareContainer.innerHTML = '';
        
        // Render products in compare list
		compareList.forEach((product, index) => {
			const productEl = document.createElement('div');
			productEl.className = 'compare-product' + (product.isMain ? ' main-product' : '');
			productEl.innerHTML = `
				<div class="remove-product" data-index="${index}">×</div>
				<img src="${product.Image_url || './images/placeholder.jpg'}" alt="${product.Title}">
				<div class="compare-desc">
					<h4>${product.Title}</h4>
					<p>From R${product.LowestPrice || 'N/A'}</p>
				</div>
			`;
			// Add click handler to redirect to view page
			productEl.addEventListener('click', function(e){
				// Prevent redirect if X button is clicked
				if(e.target.classList.contains('remove-product')) return;
				window.location.href = 'view.html?productID=' + product.ProductID;
			});
			compareContainer.appendChild(productEl);
		});
        
        // Add empty product boxes
        const emptySlots = 4 - compareList.length;
        for(let i = 0; i < emptySlots; i++){
            const emptyEl = document.createElement('div');
            emptyEl.className = 'compare-product add-product';
            emptyEl.innerHTML = `
                <i class="fa-solid fa-plus"></i>
                <span>Add Product</span>
            `;
            emptyEl.addEventListener('click', openProductSearch);
            compareContainer.appendChild(emptyEl);
        }
        
        // Add event listeners to remove buttons
        const removeButtons = document.querySelectorAll('.remove-product');
        removeButtons.forEach(btn => {
            btn.addEventListener('click', function(e){
                e.stopPropagation();
                const index = parseInt(this.getAttribute('data-index'));
                removeProductFromCompare(index);
                renderCompareGrid();
            });
        });
        
		// Remove comparison table if no products left
		if(compareList.length === 0){
			const existingTable = document.querySelector('.compare-table-container');
			if(existingTable){
				existingTable.remove();
			}
    		return;
		}

        // If we have products to compare, add comparison table
        if(compareList.length > 0){
            renderComparisonTable();
        }
    }
    
    // Function to remove product from compare list
    function removeProductFromCompare(index){
        // If removing main product and there are others, set next product as main
        if(compareList[index].isMain && compareList.length > 1){
            compareList[index === 0 ? 1 : 0].isMain = true;
        }
        
        // Remove product
        compareList.splice(index, 1);
        // Save to localStorage
        localStorage.setItem('compareList', JSON.stringify(compareList));
		// Reload from localStorage to ensure sync
		compareList = JSON.parse(localStorage.getItem('compareList')) || [];
    }
    
	function renderComparisonTable(){
		// Remove existing table if any
		const existingTable = document.querySelector('.compare-table-container');
		if(existingTable){
			existingTable.remove();
		}

		// Create table container
		const tableContainer = document.createElement('div');
		tableContainer.className = 'compare-table-container';

		// Create table
		const table = document.createElement('table');
		table.className = 'compare-table';

		// Headers row
		const thead = document.createElement('thead');
		const headerRow = document.createElement('tr');

		// First cell is "Attribute"
		const attrTh = document.createElement('th');
		attrTh.textContent = 'Attribute';
		headerRow.appendChild(attrTh);

		// Add product headers with image and name
		compareList.forEach(product => {
			const th = document.createElement('th');
			const headerDiv = document.createElement('div');
			headerDiv.className = 'compare-table-header';
			headerDiv.innerHTML = `
				<img src="${product.Image_url || './images/placeholder.jpg'}" alt="${product.Title}"/>
				<span>${product.Title}</span>
			`;
			th.appendChild(headerDiv);
			headerRow.appendChild(th);
		});

		thead.appendChild(headerRow);
		table.appendChild(thead);

		// Table body
		const tbody = document.createElement('tbody');

		// Price row
		const priceRow = document.createElement('tr');
		const priceLabel = document.createElement('td');
		priceLabel.textContent = 'Price';
		priceRow.appendChild(priceLabel);
		compareList.forEach(product => {
			const td = document.createElement('td');
			td.textContent = product.LowestPrice ? `R${product.LowestPrice}` : 'N/A';
			priceRow.appendChild(td);
		});
		tbody.appendChild(priceRow);

		// Retailers row
		const hasRetailers = compareList.some(p => p.Retailers && p.Retailers.length);
		if(hasRetailers){
			const retailersRow = document.createElement('tr');
			const retailersLabel = document.createElement('td');
			retailersLabel.textContent = 'Retailers';
			retailersRow.appendChild(retailersLabel);

			compareList.forEach(product => {
				const td = document.createElement('td');
				if(product.Retailers && product.Retailers.length){
					const ul = document.createElement('ul');
					ul.className = 'retailer-list';
					product.Retailers.forEach(retailer => {
						const li = document.createElement('li');
						li.textContent = retailer.Name;
						ul.appendChild(li);
					});
					td.appendChild(ul);
				} else {
					td.textContent = 'N/A';
				}
				retailersRow.appendChild(td);
			});
			tbody.appendChild(retailersRow);
		}

		// Add spec rows 
		const allSpecTypes = new Set();
		compareList.forEach(product => {
			if(product.Specifications){
				Object.keys(product.Specifications).forEach(spec => {
					allSpecTypes.add(spec);
				});
			}
		});

		allSpecTypes.forEach(specType => {
			const specRow = document.createElement('tr');
			const specLabel = document.createElement('td');
			specLabel.textContent = specType;
			specRow.appendChild(specLabel);

			compareList.forEach(product => {
				const td = document.createElement('td');
				td.textContent = product.Specifications && product.Specifications[specType]
					? product.Specifications[specType]
					: 'N/A';
				specRow.appendChild(td);
			});

			tbody.appendChild(specRow);
		});

		table.appendChild(tbody);
		tableContainer.appendChild(table);

		// Add table to the page 
		document.getElementById('compare-grid').appendChild(tableContainer);
	}
    
    // Initial render
    renderCompareGrid();
});