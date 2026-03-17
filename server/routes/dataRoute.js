const express = require('express');

const router = express.Router();
const {
  findWarNote,
  findReducedWar,
  findAsyApplicationAll,
  findRouteDeath,
  findRouteIbcCountryList,
  findRouteIbc,
} = require('../controllers/api/data/dataController');

router.get('/note/:id', async (req, res) => {
  try {
    const data = await findWarNote(+req.params.id);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/reduced_war_data', async (req, res) => {
  try {
    const data = await findReducedWar();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/asy_application_all', async (req, res) => {
  try {
    const data = await findAsyApplicationAll();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/route_death', async (req, res) => {
  try {
    const data = await findRouteDeath();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/route_IBC_country_list', async (req, res) => {
  try {
    const data = await findRouteIbcCountryList();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/route_IBC', async (req, res) => {
  try {
    const data = await findRouteIbc();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
