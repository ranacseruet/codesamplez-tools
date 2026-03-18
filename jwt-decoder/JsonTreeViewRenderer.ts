/**
 * Renders JSON data into an interactive tree view within a specified container.
 */
export class JsonTreeViewRenderer {
    /**
     * Renders the JSON data into the container element.
     */
    render(jsonData: unknown, container: HTMLElement | null): void {
        if (!container) {
            return;
        }

        container.innerHTML = '';
        const wrapper = document.createElement('div');
        this.#renderJsonValue(jsonData, wrapper);
        container.appendChild(wrapper);
    }

    /**
     * Renders the appropriate HTML representation for a given JSON value.
     */
    #renderJsonValue(value: unknown, container: HTMLElement): void {
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
            stringSpan.textContent = `"${value}"`;
            container.appendChild(stringSpan);
            return;
        }

        if (typeof value === 'number') {
            const numberSpan = document.createElement('span');
            numberSpan.className = 'jwt-decoder-json-number';
            numberSpan.textContent = String(value);
            container.appendChild(numberSpan);
            return;
        }

        if (typeof value === 'boolean') {
            const booleanSpan = document.createElement('span');
            booleanSpan.className = 'jwt-decoder-json-boolean';
            booleanSpan.textContent = String(value);
            container.appendChild(booleanSpan);
            return;
        }

        if (Array.isArray(value)) {
            this.#renderArray(value, container);
            return;
        }

        if (typeof value === 'object') {
            this.#renderObject(value as Record<string, unknown>, container);
        }
    }

    /**
     * Renders an array value.
     */
    #renderArray(array: unknown[], container: HTMLElement): void {
        const arrayOpen = document.createElement('span');
        arrayOpen.textContent = '[';
        container.appendChild(arrayOpen);

        if (array.length > 0) {
            const arrayContent = document.createElement('div');
            arrayContent.style.marginLeft = '20px';

            array.forEach((item, index) => {
                const itemContainer = document.createElement('div');
                this.#renderJsonValue(item, itemContainer);

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
     */
    #renderObject(objectValue: Record<string, unknown>, container: HTMLElement): void {
        const objectOpen = document.createElement('span');
        objectOpen.textContent = '{';
        container.appendChild(objectOpen);

        const keys = Object.keys(objectValue);
        if (keys.length > 0) {
            const objectContent = document.createElement('div');
            objectContent.style.marginLeft = '20px';

            keys.forEach((key, index) => {
                const propertyLine = document.createElement('div');
                propertyLine.className = 'jwt-decoder-json-key-value';

                const keyElement = document.createElement('span');
                keyElement.className = 'jwt-decoder-json-key';
                keyElement.textContent = `"${key}": `;
                propertyLine.appendChild(keyElement);

                this.#renderJsonValue(objectValue[key], propertyLine);

                if (index < keys.length - 1) {
                    const comma = document.createElement('span');
                    comma.textContent = ',';
                    propertyLine.appendChild(comma);
                }

                objectContent.appendChild(propertyLine);
            });

            container.appendChild(objectContent);
        }

        const objectClose = document.createElement('span');
        objectClose.textContent = '}';
        container.appendChild(objectClose);
    }
}
