from playwright.sync_api import sync_playwright

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    context = browser.new_context()
    page = context.new_page()

    # Navigate to the JWT Builder tool
    # Depending on how webpack dev server is configured, it might serve from root or build folder.
    # Trying root first.
    page.goto("http://localhost:8081/jwt-builder-tool/index.html")

    # Wait for the tool to load
    page.wait_for_selector(".jwt-builder-container")

    # Take initial screenshot
    page.screenshot(path="verification/initial_state.png")

    # Get initial value of exp
    exp_input = page.locator("#exp")
    initial_exp = exp_input.input_value()
    print(f"Initial exp: {initial_exp}")

    # Click +1h button
    # Using aria-label to locate is best practice
    plus_1h_btn = page.get_by_label("Set expiration to 1 hour from now")
    plus_1h_btn.click()

    # Verify exp changed
    new_exp = exp_input.input_value()
    print(f"New exp: {new_exp}")

    if initial_exp == new_exp:
        print("Error: Expiration did not update!")
    else:
        print("Expiration updated successfully.")

    # Click Now button for iat
    iat_input = page.locator("#iat")
    initial_iat = iat_input.input_value()

    now_btn = page.get_by_label("Set issued at to now")
    now_btn.click()

    new_iat = iat_input.input_value()
    print(f"New iat: {new_iat}")

    # Take final screenshot showing buttons and updated values
    page.screenshot(path="verification/verification.png")

    browser.close()

with sync_playwright() as playwright:
    run(playwright)
