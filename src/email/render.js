import { renderToString } from 'react-dom/server';

/**
 * Renders a React email template component to an HTML string.
 *
 * @param {React.ComponentType} Template  — The React component to render
 * @param {Object}              data      — Props to pass to the template
 * @returns {string}                      — Full HTML document string
 */
export function renderDigestHtml(Template, data) {
  // @react-email/components handles CSS inlining internally.
  // Using renderToString rather than @react-email's render()
  // to avoid an extra dependency on its internals.
  return '<!DOCTYPE html>' + renderToString(<Template data={data} />);
}
