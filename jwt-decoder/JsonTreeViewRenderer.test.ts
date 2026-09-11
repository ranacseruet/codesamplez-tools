import { JsonTreeViewRenderer } from './JsonTreeViewRenderer';

// Helper function to simplify container creation and rendering
const renderToJsonHtml = (jsonData: unknown): string => {
    const container = document.createElement('div');
    const renderer = new JsonTreeViewRenderer();
    renderer.render(jsonData, container);
    // Trim whitespace between tags for easier comparison
    return container.innerHTML.replace(/>\s+</g, '><');
};

describe('JsonTreeViewRenderer', () => {
    let container: HTMLDivElement;
    let renderer: JsonTreeViewRenderer;

    beforeEach(() => {
        // Create a fresh container for each test
        container = document.createElement('div');
        renderer = new JsonTreeViewRenderer();
    });

    test('should render a simple flat JSON object', () => {
        const jsonData = {
            name: 'Cline',
            version: 1.0,
            active: true,
            config: null
        };
        renderer.render(jsonData, container);

        // Check root structure
        expect(container.children.length).toBe(1); // Should have one main wrapper div
        const rootWrapper = container.firstChild as HTMLDivElement;
        expect(rootWrapper.tagName).toBe('DIV');

        // Check object rendering structure
        const objectOpen = rootWrapper.children[0] as HTMLElement;
        expect(objectOpen.tagName).toBe('SPAN');
        expect(objectOpen.textContent).toBe('{');
        const objectContent = rootWrapper.children[1] as HTMLElement;
        expect(objectContent.tagName).toBe('DIV');
        expect(objectContent.style.marginLeft).toBe('20px');
        const objectClose = rootWrapper.children[2] as HTMLElement;
        expect(objectClose.tagName).toBe('SPAN');
        expect(objectClose.textContent).toBe('}');

        // Check properties within the object content div
        expect(objectContent.children.length).toBe(4);

        // Check first property (string)
        const prop1 = objectContent.children[0] as HTMLElement;
        expect(prop1.querySelector('.jwt-decoder-json-key')?.textContent).toBe('"name": ');
        expect(prop1.querySelector('.jwt-decoder-json-string')?.textContent).toBe('"Cline"');
        expect(prop1.querySelector('span:last-child')?.textContent).toBe(',');

        // Check second property (number)
        const prop2 = objectContent.children[1] as HTMLElement;
        expect(prop2.querySelector('.jwt-decoder-json-key')?.textContent).toBe('"version": ');
        expect(prop2.querySelector('.jwt-decoder-json-number')?.textContent).toBe('1');
        expect(prop2.querySelector('span:last-child')?.textContent).toBe(',');

        // Check third property (boolean)
        const prop3 = objectContent.children[2] as HTMLElement;
        expect(prop3.querySelector('.jwt-decoder-json-key')?.textContent).toBe('"active": ');
        expect(prop3.querySelector('.jwt-decoder-json-boolean')?.textContent).toBe('true');
        expect(prop3.querySelector('span:last-child')?.textContent).toBe(',');

        // Check fourth property (null)
        const prop4 = objectContent.children[3] as HTMLElement;
        expect(prop4.className).toBe('jwt-decoder-json-key-value');
        expect(prop4.querySelector('.jwt-decoder-json-key')?.textContent).toBe('"config": ');
        const nullSpan = prop4.querySelector('.jwt-decoder-json-null');
        expect(nullSpan).not.toBeNull();
        expect(nullSpan?.textContent).toBe('null');
        expect(prop4.lastElementChild).toBe(nullSpan);
        expect(prop4.querySelector('span:last-of-type')?.textContent).not.toBe(',');
    });

    test('should render an empty object', () => {
        const jsonData = {};
        const expectedHtml = '<div><span>{</span><span>}</span></div>';
        expect(renderToJsonHtml(jsonData)).toBe(expectedHtml);
    });

    test('should render a simple array', () => {
        const jsonData = ['apple', 123, false];
        renderer.render(jsonData, container);

        // Check root structure
        expect(container.children.length).toBe(1);
        const rootWrapper = container.firstChild as HTMLDivElement;
        expect(rootWrapper.tagName).toBe('DIV');

        // Check array rendering structure
        const arrayOpen = rootWrapper.children[0] as HTMLElement;
        expect(arrayOpen.tagName).toBe('SPAN');
        expect(arrayOpen.textContent).toBe('[');
        const arrayContent = rootWrapper.children[1] as HTMLElement;
        expect(arrayContent.tagName).toBe('DIV');
        expect(arrayContent.style.marginLeft).toBe('20px');
        const arrayClose = rootWrapper.children[2] as HTMLElement;
        expect(arrayClose.tagName).toBe('SPAN');
        expect(arrayClose.textContent).toBe(']');

        // Check items within the array content div
        expect(arrayContent.children.length).toBe(3);

        // Check first item (string)
        const item1 = arrayContent.children[0] as HTMLElement;
        expect(item1.querySelector('.jwt-decoder-json-string')?.textContent).toBe('"apple"');
        expect(item1.querySelector('span:last-child')?.textContent).toBe(',');

        // Check second item (number)
        const item2 = arrayContent.children[1] as HTMLElement;
        expect(item2.querySelector('.jwt-decoder-json-number')?.textContent).toBe('123');
        expect(item2.querySelector('span:last-child')?.textContent).toBe(',');

        // Check third item (boolean)
        const item3 = arrayContent.children[2] as HTMLElement;
        const boolSpan = item3.querySelector('.jwt-decoder-json-boolean');
        expect(boolSpan?.textContent).toBe('false');
        expect(item3.lastElementChild).toBe(boolSpan);
    });

    test('should render an empty array', () => {
        const jsonData: unknown[] = [];
        const expectedHtml = '<div><span>[</span><span>]</span></div>';
        expect(renderToJsonHtml(jsonData)).toBe(expectedHtml);
    });

    test('should render a nested object', () => {
        const jsonData = {
            user: {
                id: 1,
                details: {
                    email: 'test@example.com'
                }
            },
            status: 'active'
        };
        renderer.render(jsonData, container);

        // Basic check: Ensure email is rendered correctly deep inside
        const emailSpan = container.querySelector('.jwt-decoder-json-string');
        expect(emailSpan).not.toBeNull();
        const emailValueSpan = Array.from(container.querySelectorAll('.jwt-decoder-json-string'))
            .find((span) => span.textContent === '"test@example.com"');
        expect(emailValueSpan).toBeDefined();

        const rootContentDiv = (container.firstChild as HTMLElement).querySelector('div') as HTMLElement;
        const userPropDiv = rootContentDiv.children[0] as HTMLElement;
        expect(userPropDiv.querySelector('.jwt-decoder-json-key')?.textContent).toBe('"user": ');

        const userObjectOpenSpan = userPropDiv.querySelector('span:nth-of-type(2)');
        expect(userObjectOpenSpan?.textContent).toBe('{');
        const userObjectContentDiv = userPropDiv.querySelector('div[style*="margin-left"]');
        expect(userObjectContentDiv).not.toBeNull();

        const detailsPropDiv = (userObjectContentDiv as HTMLElement).children[1] as HTMLElement;
        const detailsKeySpan = detailsPropDiv.querySelector('.jwt-decoder-json-key');
        expect(detailsKeySpan?.textContent).toBe('"details": ');

        const detailsObjectOpenSpan = detailsPropDiv.querySelector('span:nth-of-type(2)');
        expect(detailsObjectOpenSpan?.textContent).toBe('{');
        const detailsObjectContentDiv = detailsPropDiv.querySelector('div[style*="margin-left"]');
        expect(detailsObjectContentDiv).not.toBeNull();

        const emailPropDiv = (detailsObjectContentDiv as HTMLElement).children[0] as HTMLElement;
        const emailKeySpan = emailPropDiv.querySelector('.jwt-decoder-json-key');
        expect(emailKeySpan?.textContent).toBe('"email": ');
        expect(emailPropDiv.querySelector('.jwt-decoder-json-string')?.textContent).toBe('"test@example.com"');
    });

    test('should render an object with an array', () => {
        const jsonData = {
            items: [1, 'two', { nested: true }],
            count: 3
        };
        renderer.render(jsonData, container);

        const itemsPropDiv = (container.firstChild as HTMLElement).querySelector('div')!.children[0] as HTMLElement;
        expect(itemsPropDiv.querySelector('.jwt-decoder-json-key')?.textContent).toBe('"items": ');

        const arrayOpen = itemsPropDiv.querySelector('span:nth-of-type(2)');
        expect(arrayOpen?.textContent).toBe('[');
        const arrayContent = itemsPropDiv.querySelector('div[style*="margin-left"]') as HTMLElement;
        expect(arrayContent).not.toBeNull();
        expect(arrayContent.style.marginLeft).toBe('20px');
        const arrayClose = itemsPropDiv.querySelector('span:nth-of-type(3)');
        expect(arrayClose?.textContent).toBe(']');

        // Check items within the array
        expect(arrayContent.children.length).toBe(3);
        expect(arrayContent.children[0].querySelector('.jwt-decoder-json-number')?.textContent).toBe('1');
        expect(arrayContent.children[1].querySelector('.jwt-decoder-json-string')?.textContent).toBe('"two"');

        // Check nested object within array
        const nestedObjDiv = arrayContent.children[2] as HTMLElement;
        expect(nestedObjDiv.querySelector('span:first-child')?.textContent).toBe('{');
        expect(nestedObjDiv.querySelector('.jwt-decoder-json-key')?.textContent).toBe('"nested": ');
        const nestedBoolSpan = nestedObjDiv.querySelector('.jwt-decoder-json-boolean');
        expect(nestedBoolSpan?.textContent).toBe('true');
        const closingBrace = nestedObjDiv.lastElementChild as HTMLElement;
        expect(closingBrace.tagName).toBe('SPAN');
        expect(closingBrace.textContent).toBe('}');
        expect(nestedObjDiv.nextElementSibling).toBeNull();

        // Check count property
        const countPropDiv = (container.firstChild as HTMLElement).querySelector('div')!.children[1] as HTMLElement;
        expect(countPropDiv.querySelector('.jwt-decoder-json-key')?.textContent).toBe('"count": ');
        expect(countPropDiv.querySelector('.jwt-decoder-json-number')?.textContent).toBe('3');
    });

    test('should create correct structure for non-root object elements', () => {
        const jsonData = { parent: { child: 'value' } };
        renderer.render(jsonData, container);

        const parentPropLine = (container.firstChild as HTMLElement).querySelector('div')!.children[0] as HTMLElement;
        expect(parentPropLine.tagName).toBe('DIV');
        expect(parentPropLine.className).toBe('jwt-decoder-json-key-value');

        const parentKeySpan = parentPropLine.querySelector('.jwt-decoder-json-key');
        expect(parentKeySpan).not.toBeNull();
        expect(parentKeySpan?.textContent).toBe('"parent": ');

        const nestedObjectOpen = parentPropLine.querySelector('span:nth-of-type(2)');
        expect(nestedObjectOpen).not.toBeNull();
        expect(nestedObjectOpen?.textContent).toBe('{');
        const nestedObjectContent = parentPropLine.querySelector('div[style*="margin-left"]');
        expect(nestedObjectContent).not.toBeNull();
        const nestedObjectClose = parentPropLine.querySelector('span:nth-of-type(3)');
        expect(nestedObjectClose).not.toBeNull();
        expect(nestedObjectClose?.textContent).toBe('}');
    });

    test('should handle rendering directly into the container if jsonData is primitive (though not typical use)', () => {
        renderer.render('Just a string', container);
        expect(container.innerHTML).toBe('<div><span class="jwt-decoder-json-string">"Just a string"</span></div>');

        renderer.render(12345, container);
        expect(container.innerHTML).toBe('<div><span class="jwt-decoder-json-number">12345</span></div>');

        renderer.render(true, container);
        expect(container.innerHTML).toBe('<div><span class="jwt-decoder-json-boolean">true</span></div>');

        renderer.render(null, container);
        expect(container.innerHTML).toBe('<div><span class="jwt-decoder-json-null">null</span></div>');
    });

    test('should do nothing when jsonData is undefined or function', () => {
        renderer.render(undefined, container);
        expect(container.innerHTML).toBe('<div></div>');

        renderer.render((() => {}) as unknown, container);
        expect(container.innerHTML).toBe('<div></div>');
    });

    test('should clear previous content before rendering', () => {
        container.innerHTML = '<p>Old content</p>';
        renderer.render({ message: 'New content' }, container);
        expect(container.querySelector('p')).toBeNull();
        expect(container.querySelector('.jwt-decoder-json-key')?.textContent).toBe('"message": ');
    });

    test('should not render if container is null or undefined', () => {
        const jsonData = { test: 1 };
        renderer.render(jsonData, null);
        renderer.render(jsonData, undefined as unknown as HTMLElement);
    });
});
