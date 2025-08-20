function isValidDomain(domain) {
  if (!domain || typeof domain !== 'string') return false;
  
  domain = domain.trim().toLowerCase();
  
  if (domain.length > 253) return false;
  
  const domainRegex = /^([a-z0-9]+(-[a-z0-9]+)*\.)*[a-z0-9]+(-[a-z0-9]+)*$/;
  
  const cleanDomain = domain
    .replace(/^(https?:\/\/)?(www\.)?/, '')
    .replace(/\/.*$/, '')
    .replace(/:\d+$/, '');
  
  if (!cleanDomain) return false;
  
  const parts = cleanDomain.split('.');
  if (parts.length < 2) return false;
  
  return parts.every(part => 
    part.length > 0 && 
    part.length <= 63 && 
    /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(part)
  );
}

function normalizeDomain(url) {
  url = url.trim().toLowerCase();
  url = url.replace(/^(https?:\/\/)?(www\.)?/, '');
  url = url.replace(/\/.*$/, '');
  return url;
}

export { isValidDomain, normalizeDomain };