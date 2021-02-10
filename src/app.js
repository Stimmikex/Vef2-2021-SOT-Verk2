import express from 'express';
import dotenv from 'dotenv';
import { body, validationResult } from 'express-validator';
import { query } from './db.js';

dotenv.config();

const {
  PORT: port = 3000,
} = process.env;

const app = express();

// TODO setja upp rest af virkni!

app.set('views', 'views');
app.set('view engine', 'ejs');

app.use(express.static('public'));

app.use(express.urlencoded({
  extended: true,
}));

async function getData() {
  let data = await query('SELECT * FROM signatures');
  data = data.rows;
  try {
    return data; 
  } catch (e) {
    // eslint-disable-next-line no-console
    console.log(e);
  }
}

function checker() {
  const check = body('check').checked;
  if (check) {
    return true;
  }
  return false;
}

const nationalIdPattern = '^[0-9]{6}-?[0-9]{4}$';

app.get('/', async (req, res) => {
  const data = await getData();
  try {
    res.render('index', { title: 'Undirskriftarlisti', data});
  } catch (e) {
    // eslint-disable-next-line no-console
    console.log(e);
  }
});

app.post(
  '/',
  // Þetta er bara validation, ekki sanitization
  body('name')
    .isLength({ min: 1 })
    .withMessage('Nafn má ekki vera tómt'),
  body('nationalId')
    .isLength({ min: 1 })
    .withMessage('Kennitala má ekki vera tóm'),
  body('nationalId')
    .matches(new RegExp(nationalIdPattern))
    .withMessage('Kennitala verður að vera á formi 000000-0000 eða 0000000000'),
  body('text'),
  body('check'),

  (req, res, next) => {
    const {
      name = '',
      nationalId = '',
      text = '',
      check = '',
    } = req.body;

    const errors = validationResult(req);

    // if (!errors.isEmpty()) {
    //   const errorMessages = errors.array().map(i => i.msg);
    //   return res.send(
    //     `${template(name, nationalId, text, check)}
    //     <p>Villur:</p>
    //     <ul>
    //       <li>${errorMessages.join('</li><li>')}</li>
    //     </ul>
    //   `,
    //   );
    // }
    return next();
  },
  /* Nú sanitizeum við gögnin, þessar aðgerðir munu breyta gildum í body.req */
  // Fjarlægja whitespace frá byrjun og enda
  // „Escape“ á gögn, breytir stöfum sem hafa merkingu í t.d. HTML í entity
  // t.d. < í &lt;
  body('name').trim().escape(),

  // Fjarlægjum - úr kennitölu, þó svo við leyfum í innslátt þá viljum við geyma
  // á normalizeruðu formi (þ.e.a.s. allar geymdar sem 10 tölustafir)
  // Hér gætum við viljað breyta kennitölu í heiltölu (int) en... það myndi
  // skemma gögnin okkar, því kennitölur geta byrjað á 0
  body('nationalId').blacklist('-'),

  async (req, res) => {
    const {
      name,
      nationalId,
      text,
      check,
    } = req.body;

    query('INSERT INTO signatures(name, nationalId, comment, anonymous) VALUES($1, $2, $3, $4) RETURNING *', [name, nationalId, text, checker()]);
    const data = await getData();
    return res.render('index',{ title: 'Undirskriftarlisti', data, nationalIdPattern});
  },
);

app.use((req, res, next) => {
  res.status(404).send("Sorry can't find that!");
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Something broke!');
});

// Verðum að setja bara *port* svo virki á heroku
app.listen(port, () => {
  console.info(`Server running at http://localhost:${port}/`);
});
