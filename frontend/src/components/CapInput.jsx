const capFirst = (value) =>
  value ? value.charAt(0).toUpperCase() + value.slice(1) : value;

const makeHandler = (name, onChange) => (e) =>
  onChange({ target: { name, value: capFirst(e.target.value) } });

export function CapInput({ name, onChange, ...props }) {
  return <input name={name} {...props} onChange={makeHandler(name, onChange)} />;
}

export function CapTextarea({ name, onChange, ...props }) {
  return <textarea name={name} {...props} onChange={makeHandler(name, onChange)} />;
}
