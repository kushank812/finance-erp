import {
  pageHeader,
  eyebrow,
  pageTitle,
  pageSubtitle,
  headerActions,
} from "./uiStyles";

export default function PageHeaderBlock({
  eyebrowText = "",
  title = "",
  subtitle = "",
  actions = null,
}) {
  return (
    <div style={pageHeader}>
      <div>
        {eyebrowText ? <div style={eyebrow}>{eyebrowText}</div> : null}
        <h1 style={pageTitle}>{title}</h1>
        {subtitle ? <p style={pageSubtitle}>{subtitle}</p> : null}
      </div>

      {actions ? <div style={headerActions}>{actions}</div> : null}
    </div>
  );
}