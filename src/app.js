import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import errorHandler from './middlewares/errorHandler.js';
import notFound from './middlewares/notFound.js';
import routes from './routes/index.js';

const app = express();

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  }),
);
app.use(cors());
app.use(express.json());

app.use(routes);
app.use(notFound);
app.use(errorHandler);

export default app;
