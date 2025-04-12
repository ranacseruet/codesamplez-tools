/**
 * Renders JSON data into an interactive tree view within a specified container.
 */
export class JsonTreeViewRenderer {
    /**
     * Renders the JSON data into the container element.
     * @param {any} jsonData - The JSON data to render.
     * @param {HTMLElement} container - The container element to render into.
     */
    render(jsonData, container) {
        if (!container) return;
        container.innerHTML = ''; // Clear previous content
        container.appendChild(this.#createJsonElement(null, jsonData, true));
    }

    /**
     * Creates the main element for a JSON key-value pair or root value.
     * @param {string | null} key - The JSON key (null for root or array items).
     * @param {any} value - The JSON value.
     * @param {boolean} isRoot - Indicates if this is the root element.
     * @returns {HTMLElement} - The created HTML element.
     * @private
     */
    #createJsonElement(key, value, isRoot = false) {
        const wrapper = document.createElement('div');

        if (isRoot) {
            this.#renderJsonValue(value, wrapper, key); // Pass key for context in arrays
            return wrapper;
        }

        const keyValueLine = document.createElement('div');
        keyValueLine.className = 'jwt-decoder-json-key-value';

        const keyElement = document.createElement('span');
        keyElement.className = 'jwt-decoder-json-key';
        keyElement.textContent = `"${key}": `;
        keyValueLine.appendChild(keyElement);

        wrapper.appendChild(keyValueLine);

        this.#renderJsonValue(value, keyValueLine, key); // Pass key for context
        return wrapper;
    }

    /**
     * Renders the appropriate HTML representation for a given JSON value.
     * @param {any} value - The JSON value to render.
     * @param {HTMLElement} container - The parent element to append the rendered value to.
     * @param {string | null} key - The key associated with this value (used for array context).
     * @private
     */
    #renderJsonValue(value, container, key) {
        if (value === null) {
            const nullSpan = document.createElement('span');
            nullSpan.className = 'jwt-decoder-json-null';
            nullSpan.textContent = 'null';
            container.appendChild(nullSpan);
            return;
        }

        if (typeof value === 'string') {
            const stringSpan = document.createElement('span');
            stringSpan.className = 'jwt-decoder-json-string';
            stringSpan.textContent = `"${value}"`; // Keep quotes for strings
            container.appendChild(stringSpan);
            return;
        }

        if (typeof value === 'number') {
            const numSpan = document.createElement('span');
            numSpan.className = 'jwt-decoder-json-number';
            numSpan.textContent = value;
            container.appendChild(numSpan);
            return;
        }

        if (typeof value === 'boolean') {
            const boolSpan = document.createElement('span');
            boolSpan.className = 'jwt-decoder-json-boolean';
            boolSpan.textContent = value;
            container.appendChild(boolSpan);
            return;
        }

        if (Array.isArray(value)) {
            this.#renderArray(value, container, key);
            return;
        }

        if (typeof value === 'object') {
            this.#renderObject(value, container);
            return;
        }
    }

    /**
     * Renders an array value.
     * @param {Array<any>} array - The array to render.
     * @param {HTMLElement} container - The parent element.
     * @param {string | null} key - The key associated with this array.
     * @private
     */
    #renderArray(array, container, key) {
        const arrayOpen = document.createElement('span');
        arrayOpen.textContent = '[';
        container.appendChild(arrayOpen);

        if (array.length > 0) {
            const arrayContent = document.createElement('div');
            arrayContent.style.marginLeft = '20px'; // Indentation

            array.forEach((item, index) => {
                const itemContainer = document.createElement('div');

                // Render the value recursively
                this.#renderJsonValue(item, itemContainer, null); // Pass null key for array items

                // Add comma if not the last item
                if (index < array.length - 1) {
                    const comma = document.createElement('span');
                    comma.textContent = ',';
                    itemContainer.appendChild(comma);
                }

                arrayContent.appendChild(itemContainer);
            });

            container.appendChild(arrayContent);
        }

        const arrayClose = document.createElement('span');
        arrayClose.textContent = ']';
        container.appendChild(arrayClose);
    }

    /**
     * Renders an object value.
     * @param {Object} obj - The object to render.
     * @param {HTMLElement} container - The parent element.
     * @private
     */
    #renderObject(obj, container) {
        const objectOpen = document.createElement('span');
        objectOpen.textContent = '{';
        container.appendChild(objectOpen);

        const keys = Object.keys(obj);
        if (keys.length > 0) {
            const objectContent = document.createElement('div');
            objectContent.style.marginLeft = '20px'; // Indentation

            keys.forEach((objKey, index) => {
                // Create the line for this property directly
                const propertyLine = document.createElement('div');
                // Assign a class for potential styling, consistent with the old structure's inner line
                propertyLine.className = 'jwt-decoder-json-key-value';

                // Add the key
                const keyElement = document.createElement('span');
                keyElement.className = 'jwt-decoder-json-key';
                keyElement.textContent = `"${objKey}": `;
                propertyLine.appendChild(keyElement);

                // Render the value recursively into the same line
                this.#renderJsonValue(obj[objKey], propertyLine, objKey);

                // Add comma if needed, appended directly to the property line
                if (index < keys.length - 1) {
                    const comma = document.createElement('span');
                    comma.textContent = ',';
                    propertyLine.appendChild(comma);
                }

                // Append this constructed line to the indented container
                objectContent.appendChild(propertyLine);
            });

            container.appendChild(objectContent); // Append indented properties
        }

        const objectClose = document.createElement('span');
        objectClose.textContent = '}';
        container.appendChild(objectClose);
    }
}
