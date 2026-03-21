export const fetchData = (
  url: string,
  setter: (data: unknown) => void,
  setLoader: (loading: boolean) => void,
): Promise<void> => fetch(new Request(
  url,
  {
    method: 'GET',
    cache: 'default',
  },
))
  .then(res => res.json())
  .then((data: unknown) => setter(data))
  .catch((err: unknown) => { throw err; })
  .finally(() => setLoader(false));
