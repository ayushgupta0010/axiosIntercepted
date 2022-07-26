import axios from "axios";

const baseURL = "http://127.0.0.1:8000/";
const refreshTokenURL = baseURL + "/refreshToken";

const accessToken = localStorage.getItem("accessToken");
const refreshToken = localStorage.getItem("refreshToken");

const axiosIntercepted = axios.create({
  baseURL,
  timeout: 5000,
  headers: {
    Authorization: `JWT ${accessToken}`,
    "Content-Type": "application/json",
    accept: "application/json",
  },
});

axiosIntercepted.interceptors.response.use(
  (res) => res,
  (error) => {
    const originalRequest = error.config;

    // Prevent infinite loops
    if (
      error.response.status === 401 &&
      originalRequest.url === refreshTokenURL
    ) {
      window.location.href = "/logout";
      return Promise.reject(error);
    }

    if (
      error.response.data.code === "token_not_valid" &&
      error.response.status === 401 &&
      error.response.statusText === "Unauthorized"
    ) {
      if (!refreshToken) {
        window.location.href = "/logout";
        return Promise.reject(error);
      }

      const tokenParts = JSON.parse(atob(refreshToken.split(".")[1]));

      // exp date in token is expressed in seconds, while now() returns milliseconds:
      const now = Math.ceil(Date.now() / 1000);

      if (tokenParts.exp < now) {
        window.location.href = "/logout";
        return Promise.reject(error);
      }

      return axiosIntercepted
        .post(refreshTokenURL, { refresh: refreshToken })
        .then((res) => {
          const access = res.data.access;
          localStorage.setItem("accessToken", access);
          localStorage.setItem("refreshToken", res.data.refresh);

          originalRequest.headers["Authorization"] = `JWT ${access}`;
          axiosIntercepted.defaults.headers["Authorization"] = `JWT ${access}`;

          return axiosIntercepted(originalRequest);
        })
        .catch((err) => console.log(err));
    }

    // specific error handling done elsewhere
    return Promise.reject(error);
  }
);

axiosIntercepted.interceptors.request.use((config) => {
  if (!config.url) return config;

  const currentUrl = new URL(config.url, config.baseURL);
  // parse pathName to implement variables
  Object.entries(config.urlParams || {}).forEach(([k, v]) => {
    currentUrl.pathname = currentUrl.pathname.replace(
      `:${k}`,
      encodeURIComponent(v)
    );
  });

  return {
    ...config,
    baseURL: `${currentUrl.protocol}//${currentUrl.host}`,
    url: currentUrl.pathname,
  };
});

export default axiosIntercepted;
