const Product = require('../models/productModel');
const cloudinary = require('../config/cloudinary');
const mongoose = require('mongoose');

const slugify = (value = '') => value
  .toLowerCase()
  .trim()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '');

// @desc    Fetch all products
// @route   GET /api/products
// @access  Public
const getProducts = async (req, res) => {
  try {
    const products = await Product.find({});
    res.json(products);
  } catch (error) {
    console.error('Get products error:', error);
    res.status(500).json({ message: 'Server error while fetching products' });
  }
};

// @desc    Fetch single product
// @route   GET /api/products/:id
// @access  Public
const getProductById = async (req, res) => {
  try {
    const product = await Product.findOne({ id: req.params.id });

    if (product) {
      res.json(product);
      return;
    }

    if (mongoose.Types.ObjectId.isValid(req.params.id)) {
      const fallbackProduct = await Product.findById(req.params.id);

      if (fallbackProduct) {
        res.json(fallbackProduct);
        return;
      }
    }

    res.status(404).json({ message: 'Product not found' });
  } catch (error) {
    console.error('Get product by ID error:', error);
    res.status(500).json({ message: 'Server error while fetching product' });
  }
};

// @desc    Create a product (Admin)
// @route   POST /api/products
// @access  Private/Admin
const createProduct = async (req, res) => {
  try {
    let imageUrl = '';
    
    // Check if an image was uploaded via Multer
    if (req.file) {
      // Convert buffer to base64 for Cloudinary upload
      const b64 = Buffer.from(req.file.buffer).toString("base64");
      let dataURI = "data:" + req.file.mimetype + ";base64," + b64;
      
      const uploadResponse = await cloudinary.uploader.upload(dataURI, {
        folder: 'ruvia_products'
      });
      imageUrl = uploadResponse.secure_url;
    } else {
      return res.status(400).json({ message: 'Image file is required' });
    }

    const { name, price, category, description, countInStock, originalPrice, tag, id, rating, reviews, reviewsCount, concern, ingredients, usage, benefits } = req.body;

    const product = new Product({
      id: id || slugify(name),
      name,
      price,
      category,
      image: imageUrl,
      description,
      countInStock,
      originalPrice,
      tag,
      rating,
      reviews,
      reviewsCount,
      concern,
      ingredients,
      usage,
      benefits
    });

    const createdProduct = await product.save();
    res.status(201).json(createdProduct);
    
  } catch (error) {
    res.status(500).json({ message: 'Failed to create product', error: error.message });
  }
};

// @desc    Update a product (Admin)
// @route   PUT /api/products/:id
// @access  Private/Admin
const updateProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    let imageUrl = product.image;
    
    if (req.file) {
      const b64 = Buffer.from(req.file.buffer).toString("base64");
      let dataURI = "data:" + req.file.mimetype + ";base64," + b64;
      
      const uploadResponse = await cloudinary.uploader.upload(dataURI, {
        folder: 'ruvia_products'
      });
      imageUrl = uploadResponse.secure_url;
    }

    const { name, price, category, description, countInStock, originalPrice, tag, id, rating, reviews, reviewsCount, concern, ingredients, usage, benefits } = req.body;

    product.name = name || product.name;
    product.price = price || product.price;
    product.category = category || product.category;
    product.image = imageUrl;
    product.description = description || product.description;
    product.countInStock = countInStock !== undefined ? countInStock : product.countInStock;
    product.originalPrice = originalPrice || product.originalPrice;
    product.tag = tag || product.tag;
    product.id = id || product.id || slugify(product.name);
    product.rating = rating !== undefined ? rating : product.rating;
    product.reviews = reviews !== undefined ? reviews : product.reviews;
    product.reviewsCount = reviewsCount !== undefined ? reviewsCount : product.reviewsCount;
    product.concern = concern || product.concern;
    product.ingredients = ingredients || product.ingredients;
    product.usage = usage || product.usage;
    product.benefits = benefits || product.benefits;

    const updatedProduct = await product.save();
    res.json(updatedProduct);
  } catch (error) {
    console.error('Update product error:', error);
    res.status(500).json({ message: 'Server error while updating product' });
  }
};

// @desc    Delete a product (Admin)
// @route   DELETE /api/products/:id
// @access  Private/Admin
const deleteProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    await Product.findByIdAndDelete(req.params.id);
    res.json({ message: 'Product removed successfully' });
  } catch (error) {
    console.error('Delete product error:', error);
    res.status(500).json({ message: 'Server error while deleting product' });
  }
};

module.exports = {
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct
};
