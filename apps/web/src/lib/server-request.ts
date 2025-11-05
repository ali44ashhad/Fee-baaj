import { IResponse } from '@elearning/types';
import axios, { AxiosError, Method } from 'axios';
import { cookies, headers } from 'next/headers';

const axiosInstance = axios.create({
  baseURL: process.env.API_URL,
  withCredentials: true, // Ensures credentials (cookies) are sent
});

const serverRequest = async <T, R = unknown>(
  url: string,
  method: Method = 'GET',
  data?: R
): Promise<T> => {
  try {
    // 1️⃣ Get cookies from Next.js Server Actions (it's async!)
    const cookieStore = await cookies(); // Ensure you await this
    const headerStore = await headers(); // ⬅️ Await headers()

    // Convert cookies to a string (format: "key=value; key2=value2")
    const cookieHeader = cookieStore.getAll().map(({ name, value }) => `${name}=${value}`).join('; ');
    const clientIp = headerStore.get('x-forwarded-for') || ''; // ✅ Access x-forwarded-for

    // 2️⃣ Make request to Express API with cookies
    const response = await axiosInstance<IResponse<T, R>>({
      url,
      method,
      data,
      headers: {
        Cookie: cookieHeader, // Manually forward cookies
        'x-forwarded-for': clientIp,
      },
    });

    // 3️⃣ Capture 'Set-Cookie' header and store it
    const setCookieHeader = response.headers['set-cookie'];
    if (setCookieHeader) {
      setCookieHeader.forEach((cookie) => {
        const [cookieName, cookieValue] = cookie.split(';')[0].split('=');
        cookieStore.set(cookieName, cookieValue, {
          path: '/',
          httpOnly: true,
          secure: false,
          maxAge: 365 * 24 * 60 * 60, // one year
        });
      });
    }

    return response.data.results;
  } catch (err) {
    if (err instanceof AxiosError && err.response) {
      const data = err.response?.data as IResponse<T, R>;
      throw data.results;
    }
    throw err;
  }
};

export default serverRequest;
