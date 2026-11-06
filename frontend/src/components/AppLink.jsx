import { useLocation, useNavigate } from "../context/router-context";

export function Link({ to, onClick, children, ...props }) {
  const navigate = useNavigate();

  const handleClick = (event) => {
    onClick?.(event);
    if (
      event.defaultPrevented
      || event.button !== 0
      || event.metaKey
      || event.ctrlKey
      || event.shiftKey
      || event.altKey
      || props.target === "_blank"
    ) {
      return;
    }

    event.preventDefault();
    navigate(to);
  };

  return (
    <a href={to} onClick={handleClick} {...props}>
      {children}
    </a>
  );
}

export function NavLink({ to, className, children, ...props }) {
  const location = useLocation();
  const isActive = location.pathname === to;
  const resolvedClassName = typeof className === "function"
    ? className({ isActive })
    : className;
  const resolvedChildren = typeof children === "function"
    ? children({ isActive })
    : children;

  return (
    <Link
      to={to}
      className={resolvedClassName}
      aria-current={isActive ? "page" : undefined}
      {...props}
    >
      {resolvedChildren}
    </Link>
  );
}
