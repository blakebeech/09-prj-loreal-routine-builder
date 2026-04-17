/* Get references to DOM elements */
const categoryFilter = document.getElementById("categoryFilter");
const productsContainer = document.getElementById("productsContainer");
const selectedProductsList = document.getElementById("selectedProductsList");
const clearAllBtn = document.getElementById("clearAllBtn");
const generateRoutineBtn = document.getElementById("generateRoutine");
const chatForm = document.getElementById("chatForm");
const chatWindow = document.getElementById("chatWindow");
const userInput = document.getElementById("userInput");
const sendBtn = document.getElementById("sendBtn");
const ROUTINE_SYSTEM_MESSAGE =
  "You are a beauty advisor. Only answer questions about skincare, haircare, makeup, fragrance, or the generated routine.";

/* Add a message safely to the chat window */
function addMessage(role, text, saveToHistory = true) {
  /* Only allow the two supported roles */
  if (role !== "user" && role !== "assistant") {
    return;
  }

  const messageElement = document.createElement("div");
  messageElement.classList.add("chat-message");

  /* Add a role-specific class for styling */
  if (role === "user") {
    messageElement.classList.add("user-message");
  } else {
    messageElement.classList.add("assistant-message");
  }

  /* Use textContent for safety (no HTML injection) */
  messageElement.textContent = text;
  chatWindow.appendChild(messageElement);

  /* Save each chat message in memory (skip temporary loading messages) */
  if (saveToHistory) {
    messages.push({ role, content: text });
  }

  /* Auto-scroll so the newest message is always visible */
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

/* Global arrays to store products and selections */
let allProducts = []; // Store all products loaded from JSON
let selectedProducts = []; // Store IDs of selected products
let messages = []; // Store the conversation history
let hasGeneratedRoutine = false; // Track if a routine was successfully generated

/* Enable or disable interactive inputs while requests are running */
function setRequestUIState(isLoading) {
  categoryFilter.disabled = isLoading;
  userInput.disabled = isLoading;
  generateRoutineBtn.disabled = isLoading;

  if (clearAllBtn) {
    clearAllBtn.disabled = isLoading;
  }

  if (sendBtn) {
    sendBtn.disabled = isLoading;
  }
}

/* Keep one system instruction message in the conversation history */
function ensureRoutineSystemMessage() {
  /* Remove any older system messages first */
  messages = messages.filter((message) => message.role !== "system");

  /* Add the beauty advisor instruction at the start of messages */
  messages.unshift({ role: "system", content: ROUTINE_SYSTEM_MESSAGE });
}

/* Basic keyword check to keep chat focused on beauty/routine topics */
function isBeautyRelatedQuestion(text) {
  const lowerText = text.toLowerCase();
  const allowedKeywords = [
    "skin",
    "skincare",
    "cleanser",
    "moisturizer",
    "serum",
    "sunscreen",
    "hair",
    "haircare",
    "shampoo",
    "conditioner",
    "makeup",
    "foundation",
    "concealer",
    "lipstick",
    "fragrance",
    "perfume",
    "routine",
  ];

  return allowedKeywords.some((keyword) => lowerText.includes(keyword));
}

/* Generate a routine using the currently selected products */
async function generateRoutine() {
  /* Build payload data from selected IDs only */
  const selectedProductData = selectedProducts
    .map((productId) => allProducts.find((product) => product.id === productId))
    .filter((product) => product)
    .map((product) => ({
      name: product.name,
      brand: product.brand,
      category: product.category,
      description: product.description,
    }));

  addMessage("assistant", "Generating your routine...", false);

  try {
    const response = await fetch(WORKER_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        type: "routine",
        selectedProducts: selectedProductData,
      }),
    });

    if (!response.ok) {
      throw new Error("Request failed");
    }

    const data = await response.json();
    addMessage("assistant", data.reply || "No response from assistant.");
    ensureRoutineSystemMessage();
    hasGeneratedRoutine = true;
  } catch (error) {
    hasGeneratedRoutine = false;
    addMessage(
      "assistant",
      "I couldn't generate your routine right now. Please try again in a moment.",
    );
  }
}

/* Handle Generate Routine button click */
async function handleGenerateRoutineClick() {
  /* If no products are selected, show a helpful message in chat */
  if (selectedProducts.length === 0) {
    addMessage("assistant", "Please select at least one product first.");
    return;
  }

  /* Disable inputs while loading */
  setRequestUIState(true);

  try {
    await generateRoutine();
  } finally {
    /* Re-enable inputs after response */
    setRequestUIState(false);
  }
}

/* Restore selected products from localStorage using valid IDs from allProducts */
function restoreSelectedProductsFromStorage() {
  const saved = localStorage.getItem("lorealSelectedProducts");

  /* If nothing is saved, start with an empty selection */
  if (!saved) {
    selectedProducts = [];
    return;
  }

  let savedIds = [];

  /* Parse stored JSON safely so invalid data does not break the app */
  try {
    const parsed = JSON.parse(saved);
    savedIds = Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    savedIds = [];
  }

  /* Build a set of valid IDs that actually exist in allProducts */
  const validIds = new Set(allProducts.map((product) => product.id));

  /* Keep only IDs that exist in allProducts and ignore invalid values */
  selectedProducts = savedIds.filter(
    (id) => typeof id === "number" && validIds.has(id),
  );
}

/* Save selected product IDs to browser storage */
function saveSelectedToStorage() {
  localStorage.setItem(
    "lorealSelectedProducts",
    JSON.stringify(selectedProducts),
  );
}

/* Add or remove a product from selectedProducts array based on its ID */
function toggleProductSelection(productId) {
  const index = selectedProducts.indexOf(productId);

  if (index === -1) {
    /* Product not selected - add it */
    selectedProducts.push(productId);
  } else {
    /* Product already selected - remove it */
    selectedProducts.splice(index, 1);
  }

  /* Selection changed, so routine should be generated again */
  hasGeneratedRoutine = false;

  /* Save changes and update UI */
  saveSelectedToStorage();
  renderSelectedProducts();
}

/* Display the list of selected products with name, brand, and remove button */
function renderSelectedProducts() {
  /* Check if any products are selected */
  if (selectedProducts.length === 0) {
    /* Show empty state message */
    selectedProductsList.innerHTML = `
      <p style="color: #999; font-style: italic;">
        No products selected yet
      </p>
    `;
    return;
  }

  /* Create HTML for each selected product showing name, brand, and remove button */
  const selectedHTML = selectedProducts
    .map((productId) => {
      /* Find the full product object by ID */
      const product = allProducts.find((p) => p.id === productId);
      return `
        <div class="selected-product-tag">
          <div class="product-details">
            <span class="product-name">${product.name}</span>
            <span class="product-brand">${product.brand}</span>
          </div>
          <button class="remove-product-btn" data-id="${productId}" type="button">
            ✕
          </button>
        </div>
      `;
    })
    .join("");

  selectedProductsList.innerHTML = selectedHTML;

  /* Add click handlers to remove buttons */
  document.querySelectorAll(".remove-product-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      const productId = parseInt(btn.getAttribute("data-id"));
      toggleProductSelection(productId);
      /* Re-render the products grid to update visual state */
      displayProducts(getCurrentFilteredProducts());
    });
  });
}

/* Get the products currently displayed based on category filter */
function getCurrentFilteredProducts() {
  const selectedCategory = categoryFilter.value;
  if (!selectedCategory) return [];
  return allProducts.filter((product) => product.category === selectedCategory);
}

/* Show initial placeholder until user selects a category */
productsContainer.innerHTML = `
  <div class="placeholder-message">
    Select a category to view products
  </div>
`;

/* Load product data from JSON file */
async function loadProducts() {
  const response = await fetch("products.json");
  const data = await response.json();
  allProducts = data.products; /* Store all products globally */

  /* After products load, restore saved selections using valid IDs only */
  restoreSelectedProductsFromStorage();

  /* Re-render selected list and current filtered grid after restore */
  renderSelectedProducts();
  const currentFilteredProducts = getCurrentFilteredProducts();
  displayProducts(currentFilteredProducts);

  return allProducts;
}

/* Create HTML for displaying product cards with selection state and details */
function displayProducts(products) {
  productsContainer.innerHTML = products
    .map((product) => {
      /* Check if this product is currently selected */
      const isSelected = selectedProducts.includes(product.id);
      const selectedClass = isSelected ? "selected" : "";

      return `
    <div class="product-card ${selectedClass}" data-id="${product.id}">
      <img src="${product.image}" alt="${product.name}" class="product-image">
      <div class="product-info">
        <h3 class="product-name">${product.name}</h3>
        <p class="product-brand">${product.brand}</p>
        <p class="product-category">${product.category}</p>
        <button class="view-details-btn" type="button">View Details</button>
      </div>
      <div class="product-description hidden">
        <p>${product.description}</p>
      </div>
    </div>
  `;
    })
    .join("");
}

/* Use one delegated click listener for all product card interactions */
productsContainer.addEventListener("click", (event) => {
  const detailsButton = event.target.closest(".view-details-btn");

  /* Handle View Details button click */
  if (detailsButton) {
    /* Prevent this click from also triggering product selection logic */
    event.stopPropagation();

    const productCard = detailsButton.closest(".product-card");
    if (!productCard) return;

    const descriptionBox = productCard.querySelector(".product-description");
    if (!descriptionBox) return;

    /* Toggle description visibility and button label */
    descriptionBox.classList.toggle("hidden");
    detailsButton.textContent = descriptionBox.classList.contains("hidden")
      ? "View Details"
      : "Hide Details";
    return;
  }

  /* Handle product card click for selection toggle */
  const productCard = event.target.closest(".product-card");
  if (!productCard) return;

  const productId = Number(productCard.dataset.id);
  if (Number.isNaN(productId)) return;

  toggleProductSelection(productId);
  /* Re-display products to show updated selection state */
  displayProducts(getCurrentFilteredProducts());
});

/* Filter and display products when category changes */
categoryFilter.addEventListener("change", async (e) => {
  /* Load all products if not already loaded */
  if (allProducts.length === 0) {
    await loadProducts();
  }

  const selectedCategory = e.target.value;

  /* filter() creates a new array containing only products 
     where the category matches what the user selected */
  const filteredProducts = allProducts.filter(
    (product) => product.category === selectedCategory,
  );

  displayProducts(filteredProducts);
});

/* Clear all selected products when user clicks the Clear All button */
if (clearAllBtn) {
  clearAllBtn.addEventListener("click", () => {
    /* Do nothing if there is nothing to clear */
    if (selectedProducts.length === 0) {
      return;
    }

    /* Empty selected products and clear saved selection from localStorage */
    selectedProducts = [];
    hasGeneratedRoutine = false;
    localStorage.removeItem("lorealSelectedProducts");

    /* Re-render both sections so UI stays in sync */
    displayProducts(getCurrentFilteredProducts());
    renderSelectedProducts();
  });
}

/* Generate routine when the user clicks the button */
if (generateRoutineBtn) {
  generateRoutineBtn.addEventListener("click", handleGenerateRoutineClick);
}

/* Chat form submission handler - placeholder for OpenAI integration */
chatForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const messageText = userInput.value.trim();
  if (!messageText) {
    return;
  }

  /* Prevent chat until a routine is generated first */
  if (!hasGeneratedRoutine) {
    addMessage(
      "assistant",
      "Please generate a routine first, then you can ask follow-up questions.",
    );
    return;
  }

  addMessage("user", messageText);

  /* If question is unrelated, redirect politely and skip API call */
  if (!isBeautyRelatedQuestion(messageText)) {
    addMessage(
      "assistant",
      "I can help with skincare, haircare, makeup, fragrance, or your generated routine. Please ask a question in one of those areas.",
    );
    userInput.value = "";
    return;
  }

  addMessage("assistant", "Thinking...", false);
  setRequestUIState(true);

  try {
    const response = await fetch(WORKER_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        type: "chat",
        messages,
        selectedProducts,
      }),
    });

    if (!response.ok) {
      throw new Error("Request failed");
    }

    const data = await response.json();
    addMessage("assistant", data.reply || "No response from assistant.");
  } catch (error) {
    addMessage(
      "assistant",
      "I had trouble answering that just now. Please try again.",
    );
  } finally {
    setRequestUIState(false);
  }

  userInput.value = "";
});

/* Load products on startup so localStorage selections can be restored */
addMessage(
  "assistant",
  "Welcome! I am your beauty advisor. Select products you love, then generate your personalized routine.",
  false,
);
loadProducts();
